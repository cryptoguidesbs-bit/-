import 'server-only'

import { aggregateSentiment } from '@/lib/news/pipeline'
import { globalSources, type GlobalData } from './global-sources'
import { resilientFetch, type MarketResult } from './resilient'
import { cryptoSources, sentimentSources, tickerSources, type AssetQuote, type SentimentData, type TickerQuote } from './sources'

// ---------------------------------------------------------------------------
// Market Score (v1) — a 0–100 market-condition gauge.
//
// DATA → SCORE → REASON, no AI in the loop: every input is a number we
// already serve elsewhere on the site, each is normalized to 0–100 with the
// mapping documented below (and on /data), and the score is the weighted
// mean of whatever inputs are available. Inputs that fail are reported as
// missing (partial: true) rather than invented — never a made-up number.
//
// This is a descriptive "market temperature" (risk-off ↔ risk-on), not a
// trading signal: no buy/sell language anywhere in the output.
// ---------------------------------------------------------------------------

export const SCORE_WEIGHTS_VERSION = 'v1'

export const SCORE_WEIGHTS = {
  momentum: 20, // BTC 24h change
  marketCap: 15, // total crypto market cap 24h change
  breadth: 15, // share of tracked majors up on the day
  fearGreed: 20, // Alternative.me Fear & Greed
  newsTone: 20, // news-tone sentiment over the last 24h (our own pipeline)
  stability: 10, // inverse of BTC 24h move size
} as const

export type ScoreComponentKey = keyof typeof SCORE_WEIGHTS

export type ScoreComponent = {
  key: ScoreComponentKey
  weight: number
  available: boolean
  /** Raw input in its natural unit (%, index points, share) — null if missing. */
  raw: number | null
  /** 0–100 after normalization — null if missing. */
  normalized: number | null
  /** Points this input contributed to the final score (weight-adjusted). */
  contribution: number | null
  source: string | null
  updatedAt: string | null
  stale: boolean
}

export type ScoreBand = 'cold' | 'riskOff' | 'neutral' | 'riskOn' | 'overheated'

export type MarketScore = {
  score: number | null
  band: ScoreBand | null
  partial: boolean
  missing: ScoreComponentKey[]
  stale: boolean
  components: ScoreComponent[]
  computedAt: string
  weightsVersion: typeof SCORE_WEIGHTS_VERSION
}

const MIN_INPUTS = 3

const clamp = (v: number) => Math.max(0, Math.min(100, v))

export function scoreBand(score: number): ScoreBand {
  if (score < 20) return 'cold'
  if (score < 40) return 'riskOff'
  if (score < 60) return 'neutral'
  if (score < 80) return 'riskOn'
  return 'overheated'
}

// Normalization (documented on /data):
//   momentum  : 50 + (BTC 24h %) × 8      → ±6.25% saturates
//   marketCap : 50 + (mcap 24h %) × 10    → ±5% saturates
//   breadth   : share of majors up × 100
//   fearGreed : index value as-is
//   newsTone  : 50 ± confidence/2 by tone (bullish +, bearish −)
//   stability : 100 − |BTC 24h %| × 12.5 → an 8% move scores 0
function normalize(key: ScoreComponentKey, raw: number): number {
  switch (key) {
    case 'momentum':
      return clamp(50 + raw * 8)
    case 'marketCap':
      return clamp(50 + raw * 10)
    case 'breadth':
      return clamp(raw)
    case 'fearGreed':
      return clamp(raw)
    case 'newsTone':
      return clamp(50 + raw / 2)
    case 'stability':
      return clamp(100 - Math.abs(raw) * 12.5)
  }
}

type Memo = { at: number; value: MarketScore }
const memoStore = globalThis as unknown as { __marketScoreMemo?: Map<string, Memo> }
const memo = (memoStore.__marketScoreMemo ??= new Map<string, Memo>())
const MEMO_MS = 60_000

function component(
  key: ScoreComponentKey,
  raw: number | null,
  meta: { source: string | null; updatedAt: string | null; stale: boolean },
): ScoreComponent {
  const available = typeof raw === 'number' && Number.isFinite(raw)
  return {
    key,
    weight: SCORE_WEIGHTS[key],
    available,
    raw: available ? raw : null,
    normalized: available ? Math.round(normalize(key, raw)) : null,
    contribution: null,
    ...meta,
  }
}

const metaOf = (r: MarketResult<unknown>) => ({ source: r.source, updatedAt: r.updatedAt, stale: r.stale })

export async function computeMarketScore(
  opts: { blocked?: boolean; cacheSuffix?: string } = {},
): Promise<MarketScore> {
  const { blocked = false, cacheSuffix = '' } = opts
  const memoKey = `${cacheSuffix}|${blocked ? 'blocked' : 'live'}`
  const hit = memo.get(memoKey)
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.value

  // Same cache keys as the public routes so the score never triggers extra
  // upstream calls beyond what the dashboard already makes.
  const [prices, tickers, fng, global, tone] = await Promise.all([
    resilientFetch<AssetQuote[]>(`crypto-prices${cacheSuffix}`, cryptoSources, {
      timeoutMs: 5_000, retries: 1, freshMs: 20_000, blocked,
    }),
    resilientFetch<TickerQuote[]>(`market-tickers${cacheSuffix}`, tickerSources, {
      timeoutMs: 5_000, retries: 1, freshMs: 15_000, blocked,
    }),
    resilientFetch<SentimentData>(`sentiment${cacheSuffix}`, sentimentSources, {
      timeoutMs: 5_000, retries: 1, freshMs: 5 * 60_000, blocked,
    }),
    resilientFetch<GlobalData>(`market-global${cacheSuffix}`, globalSources, {
      timeoutMs: 6_000, retries: 1, freshMs: 5 * 60_000, blocked,
    }),
    blocked
      ? Promise.resolve(null)
      : aggregateSentiment(24).catch(() => null),
  ])

  const btc = prices.data?.find((q) => q.id === 'BTC') ?? null
  const btcChange = btc ? btc.changePct : null

  const tickerRows = tickers.data ?? []
  const breadthRaw =
    tickerRows.length > 0
      ? (tickerRows.filter((t) => t.changePct > 0).length / tickerRows.length) * 100
      : null

  const toneRaw =
    tone && tone.sampleSize > 0
      ? tone.label === 'bullish'
        ? tone.confidence
        : tone.label === 'bearish'
          ? -tone.confidence
          : 0
      : null
  const toneMeta = {
    source: tone && tone.sampleSize > 0 ? 'news-tone' : null,
    updatedAt: tone && tone.sampleSize > 0 ? new Date().toISOString() : null,
    stale: false,
  }

  const components: ScoreComponent[] = [
    component('momentum', btcChange, metaOf(prices)),
    component('marketCap', global.data?.marketCapChange24hPct ?? null, metaOf(global)),
    component('breadth', breadthRaw, metaOf(tickers)),
    component('fearGreed', fng.data?.value ?? null, metaOf(fng)),
    component('newsTone', toneRaw, toneMeta),
    component('stability', btcChange, metaOf(prices)),
  ]

  const available = components.filter((c) => c.available)
  const weightSum = available.reduce((s, c) => s + c.weight, 0)
  let score: number | null = null
  if (available.length >= MIN_INPUTS && weightSum > 0) {
    const total = available.reduce((s, c) => s + (c.normalized as number) * c.weight, 0)
    score = Math.round(total / weightSum)
    for (const c of available) {
      c.contribution = Math.round(((c.normalized as number) * c.weight) / weightSum * 10) / 10
    }
  }

  const value: MarketScore = {
    score,
    band: score === null ? null : scoreBand(score),
    partial: available.length < components.length,
    missing: components.filter((c) => !c.available).map((c) => c.key),
    stale: available.some((c) => c.stale),
    components,
    computedAt: new Date().toISOString(),
    weightsVersion: SCORE_WEIGHTS_VERSION,
  }
  memo.set(memoKey, { at: Date.now(), value })
  return value
}
