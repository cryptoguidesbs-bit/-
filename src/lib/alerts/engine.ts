import 'server-only'

import type { AlertRule, SubscriptionPlan } from '@prisma/client'

import { planHasFeature } from '@/config/features'
import { resilientFetch, type MarketResult } from '@/lib/market/resilient'
import { getUsdQuotes } from '@/lib/market/quotes'
import { sentimentSources, type SentimentData } from '@/lib/market/sources'
import { whaleSources } from '@/lib/onchain/sources'
import { detectPatterns, type Candle } from '@/lib/patterns/detect'
import { klineSources, type PatternInterval, type PatternSymbol } from '@/lib/patterns/klines'
import { prisma } from '@/lib/prisma'
import { CHANNELS_REQUIRING_CONFIG, deliverToChannel } from './channels'
import {
  composeMacroAlert,
  composePatternAlert,
  composePriceAlert,
  composeWhaleAlert,
} from './compose'
import { checkAlertText } from './guidelines'
import type {
  AlertMessage,
  MacroParams,
  PatternParams,
  PriceParams,
  WhaleParams,
} from './types'

// ---------------------------------------------------------------------------
// Alert engine — evaluates active rules against live market data and fans
// out event notifications. Runs from /api/alerts/run (cron or admin).
//
// Compliance invariants enforced here:
//   · messages are composed from factual templates only (compose.ts)
//   · every message passes checkAlertText before delivery; a violation
//     records a SKIPPED delivery and nothing is sent
//   · the user's plan is re-checked at send time (alerts.realtime), so a
//     lapsed subscription silently stops deliveries
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 60 * 60_000 // one notification per rule per hour

const ENTITLED_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE']

export type RunAlertsOptions = {
  /** Test hook (non-production): behave as if upstream APIs were down. */
  blocked?: boolean
  cacheSuffix?: string
  /**
   * Test hook (non-production): text appended to each composed body before
   * the guideline check — proves the directive filter blocks bad output.
   */
  testDirectiveSuffix?: string
}

export type RunSummary = {
  evaluated: number
  cooldown: number
  planBlocked: number
  unavailable: number
  notMet: number
  fired: number
  sent: number
  failed: number
  skipped: number
}

type RuleWithUser = AlertRule & {
  user: { id: string; role: string; subscription: { plan: SubscriptionPlan; status: string } | null }
}

function planFor(user: RuleWithUser['user']): SubscriptionPlan {
  if (user.role === 'ADMIN') return 'WHALE'
  const sub = user.subscription
  return sub && ENTITLED_STATUSES.includes(sub.status) ? sub.plan : 'FREE'
}

// Lazily-fetched shared market data, one fetch per data kind per run.
class MarketData {
  constructor(private opts: RunAlertsOptions) {}

  private quotesPromise: Promise<Record<string, number | null>> | null = null
  private quoteSymbols = new Set<string>()

  collectSymbol(symbol: string) {
    this.quoteSymbols.add(symbol.toUpperCase())
  }

  quotes() {
    if (this.opts.blocked) return Promise.resolve({} as Record<string, number | null>)
    this.quotesPromise ??= getUsdQuotes(Array.from(this.quoteSymbols)).catch(() => ({}))
    return this.quotesPromise
  }

  private whalesPromise: Promise<MarketResult<{ txs: { valueUsd: number; valueBtc: number }[] }>> | null =
    null

  whales() {
    this.whalesPromise ??= resilientFetch(
      `alerts-whales${this.opts.cacheSuffix ?? ''}`,
      whaleSources,
      { timeoutMs: 10_000, retries: 1, freshMs: 60_000, blocked: this.opts.blocked },
    )
    return this.whalesPromise
  }

  private sentimentPromise: Promise<MarketResult<SentimentData>> | null = null

  sentiment() {
    this.sentimentPromise ??= resilientFetch(
      `alerts-sentiment${this.opts.cacheSuffix ?? ''}`,
      sentimentSources,
      { timeoutMs: 5_000, retries: 1, freshMs: 5 * 60_000, blocked: this.opts.blocked },
    )
    return this.sentimentPromise
  }

  private klinesCache = new Map<string, Promise<MarketResult<Candle[]>>>()

  klines(symbol: PatternSymbol, interval: PatternInterval) {
    const key = `${symbol}-${interval}`
    if (!this.klinesCache.has(key)) {
      this.klinesCache.set(
        key,
        resilientFetch(
          `klines-${symbol}-${interval}${this.opts.cacheSuffix ?? ''}`,
          klineSources(symbol, interval),
          { timeoutMs: 8_000, retries: 1, freshMs: 5 * 60_000, blocked: this.opts.blocked },
        ),
      )
    }
    return this.klinesCache.get(key)!
  }
}

type Evaluation =
  | { outcome: 'unavailable' }
  | { outcome: 'notMet' }
  | { outcome: 'fired'; message: AlertMessage }

async function evaluateRule(rule: RuleWithUser, data: MarketData): Promise<Evaluation> {
  switch (rule.type) {
    case 'PRICE': {
      const params = rule.params as PriceParams
      const quotes = await data.quotes()
      const price = quotes[params.symbol.toUpperCase()]
      if (price == null) return { outcome: 'unavailable' }
      const met = params.direction === 'above' ? price >= params.threshold : price <= params.threshold
      if (!met) return { outcome: 'notMet' }
      return { outcome: 'fired', message: composePriceAlert(params, price) }
    }
    case 'WHALE': {
      const params = rule.params as WhaleParams
      const [whales, quotes] = await Promise.all([data.whales(), data.quotes()])
      if (!whales.data) return { outcome: 'unavailable' }
      const btc = quotes['BTC'] ?? 0
      const matching = whales.data.txs
        .map((tx) => (tx.valueUsd > 0 ? tx.valueUsd : tx.valueBtc * btc))
        .filter((usd) => usd >= params.minUsd)
      if (matching.length === 0) return { outcome: 'notMet' }
      return {
        outcome: 'fired',
        message: composeWhaleAlert(params, Math.max(...matching), matching.length),
      }
    }
    case 'PATTERN': {
      const params = rule.params as PatternParams
      const klines = await data.klines(params.symbol, params.interval)
      if (!klines.data) return { outcome: 'unavailable' }
      const detection = detectPatterns(klines.data)
      const best = detection.patterns
        .filter((p) => p.confidence >= params.minConfidence)
        .sort((a, b) => b.confidence - a.confidence)[0]
      if (!best) return { outcome: 'notMet' }
      return {
        outcome: 'fired',
        message: composePatternAlert(params, best.type, best.confidence),
      }
    }
    case 'MACRO': {
      const params = rule.params as MacroParams
      const sentiment = await data.sentiment()
      if (!sentiment.data) return { outcome: 'unavailable' }
      const { value, classification } = sentiment.data
      if (value > params.low && value < params.high) return { outcome: 'notMet' }
      return { outcome: 'fired', message: composeMacroAlert(params, value, classification) }
    }
  }
}

export async function runAlerts(opts: RunAlertsOptions = {}): Promise<RunSummary> {
  const summary: RunSummary = {
    evaluated: 0,
    cooldown: 0,
    planBlocked: 0,
    unavailable: 0,
    notMet: 0,
    fired: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  const rules = (await prisma.alertRule.findMany({
    where: { active: true },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          subscription: { select: { plan: true, status: true } },
        },
      },
    },
  })) as RuleWithUser[]

  const now = Date.now()
  const data = new MarketData(opts)

  // Pre-register all PRICE/WHALE symbols so a single quote fetch serves all.
  for (const rule of rules) {
    if (rule.type === 'PRICE') data.collectSymbol((rule.params as PriceParams).symbol)
    if (rule.type === 'WHALE') data.collectSymbol('BTC')
  }

  // Channel configs, keyed by user+channel.
  const configs = await prisma.alertChannelConfig.findMany({
    where: { userId: { in: Array.from(new Set(rules.map((r) => r.userId))) } },
  })
  const configFor = (userId: string, channel: string) =>
    configs.find((c) => c.userId === userId && c.channel === channel)?.config as
      | Record<string, unknown>
      | undefined

  for (const rule of rules) {
    summary.evaluated += 1

    // Plan re-check at send time — lapsed subscriptions stop deliveries.
    if (!planHasFeature(planFor(rule.user), 'alerts.realtime')) {
      summary.planBlocked += 1
      continue
    }

    // Cooldown: at most one notification per rule per hour.
    if (rule.lastFiredAt && now - rule.lastFiredAt.getTime() < COOLDOWN_MS) {
      summary.cooldown += 1
      continue
    }

    let evaluation: Evaluation
    try {
      evaluation = await evaluateRule(rule, data)
    } catch {
      evaluation = { outcome: 'unavailable' }
    }

    if (evaluation.outcome === 'unavailable') {
      summary.unavailable += 1
      continue
    }
    if (evaluation.outcome === 'notMet') {
      summary.notMet += 1
      continue
    }

    summary.fired += 1
    const message: AlertMessage =
      process.env.NODE_ENV !== 'production' && opts.testDirectiveSuffix
        ? { ...evaluation.message, body: `${evaluation.message.body} ${opts.testDirectiveSuffix}` }
        : evaluation.message

    const baseDelivery = {
      ruleId: rule.id,
      userId: rule.userId,
      type: rule.type,
      channel: rule.channel,
      title: message.title,
      body: message.body,
    }

    // Guideline gate — event-notification form only, never directives.
    const check = checkAlertText(`${message.title} ${message.body}`)
    if (!check.ok) {
      summary.skipped += 1
      await prisma.alertDelivery.create({
        data: { ...baseDelivery, status: 'SKIPPED', error: `guideline: ${check.reason} (${check.matched})` },
      })
      continue
    }

    // Channel must be configured (except INAPP).
    const config = configFor(rule.userId, rule.channel)
    if (CHANNELS_REQUIRING_CONFIG.includes(rule.channel) && !config) {
      summary.skipped += 1
      await prisma.alertDelivery.create({
        data: { ...baseDelivery, status: 'SKIPPED', error: 'channel not configured' },
      })
      continue
    }

    const result = await deliverToChannel(rule.channel, rule.userId, config ?? null, message)
    await prisma.alertDelivery.create({
      data: {
        ...baseDelivery,
        status: result.status,
        transport: result.transport,
        error: result.error,
      },
    })

    if (result.status === 'SENT') {
      summary.sent += 1
      await prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastFiredAt: new Date() },
      })
    } else {
      summary.failed += 1
    }
  }

  return summary
}
