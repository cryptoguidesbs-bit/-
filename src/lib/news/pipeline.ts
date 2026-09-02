import 'server-only'

import { createHash } from 'node:crypto'
import type { NewsCategory } from '@prisma/client'

import { MAX_ITEMS_PER_SOURCE, newsSources } from '@/config/news-sources'
import { getAiProvider, AiRateLimitError } from '@/lib/ai/provider'
import { consumeAiBudget, AiBudgetExceededError, aiCallSpacing } from '@/lib/ai/budget'
import { sanityCheck } from '@/lib/ai/sanity'
import { prisma } from '@/lib/prisma'
import { fetchRss } from './rss'

const MAX_AI_ATTEMPTS = 2

// ---------------------------------------------------------------------------
// Categorization — keyword rules over the headline
// ---------------------------------------------------------------------------

const CATEGORY_RULES: { category: NewsCategory; pattern: RegExp }[] = [
  {
    category: 'REGULATION',
    pattern:
      /\b(sec|cftc|regulat|lawsuit|court|ban|senate|congress|law|legal|compliance|sanction)\b|규제|소송|법원/i,
  },
  {
    category: 'DEFI',
    pattern: /\b(defi|dex|uniswap|aave|lending|liquidity|yield|staking|tvl)\b|디파이|스테이킹/i,
  },
  {
    category: 'MACRO',
    pattern:
      /\b(fed|cpi|inflation|interest rate|treasury|macro|recession|gdp|dollar)\b|연준|금리|물가/i,
  },
  {
    category: 'TECHNOLOGY',
    pattern:
      /\b(upgrade|layer[- ]?2|l2|protocol|mainnet|testnet|hard ?fork|zk|rollup|scaling|network)\b|업그레이드|메인넷/i,
  },
  {
    category: 'MARKET',
    pattern:
      /\b(price|rally|surge|drop|crash|etf|all[- ]time[- ]high|ath|bull|bear|market|trading|volume)\b|가격|급등|급락|시세/i,
  },
]

export function categorize(title: string): NewsCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) return rule.category
  }
  return 'GENERAL'
}

function urlHash(url: string): string {
  // Normalize: strip tracking query params for stable dedupe.
  const base = url.split('?')[0].replace(/\/+$/, '').toLowerCase()
  return createHash('sha256').update(base).digest('hex')
}

// ---------------------------------------------------------------------------
// Step 1 — ingest: fetch region-balanced sources, dedupe, store PENDING rows
// ---------------------------------------------------------------------------

export type IngestReport = {
  ingested: number
  sources: { name: string; region: string; fetched?: number; inserted?: number; error?: string }[]
}

export async function ingestNews(): Promise<IngestReport> {
  const report: IngestReport = { ingested: 0, sources: [] }

  const results = await Promise.allSettled(
    newsSources.map(async (source) => {
      const items = (await fetchRss(source.url)).slice(0, MAX_ITEMS_PER_SOURCE)
      return { source, items }
    })
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      const index = results.indexOf(result)
      const source = newsSources[index]
      report.sources.push({
        name: source.name,
        region: source.region,
        error: String(result.reason?.message ?? result.reason).slice(0, 120),
      })
      continue
    }

    const { source, items } = result.value
    let inserted = 0
    for (const item of items) {
      const hash = urlHash(item.url)
      try {
        await prisma.newsItem.create({
          data: {
            urlHash: hash,
            title: item.title.slice(0, 500),
            url: item.url,
            source: source.name,
            region: source.region,
            category: categorize(item.title),
            publishedAt: item.publishedAt ?? new Date(),
          },
        })
        inserted += 1
      } catch {
        // Unique constraint hit — already ingested. Skip silently.
      }
    }
    report.ingested += inserted
    report.sources.push({
      name: source.name,
      region: source.region,
      fetched: items.length,
      inserted,
    })
  }

  return report
}

// ---------------------------------------------------------------------------
// Step 2 — summarize: AI analysis + sanity check + retry, publish or hold
// ---------------------------------------------------------------------------

export type SummarizeReport = {
  processed: number
  published: number
  held: number
  deferred: number
  model: string
}

export async function summarizePending(limit = 15): Promise<SummarizeReport> {
  const provider = getAiProvider()

  // Heal rows held by the budget-deferral inflation bug: they were marked
  // HELD with reason 'unknown' without a single real provider attempt (the
  // deferral path used to count attempts, so starved items hit MAX unseen).
  // Requeue them; a genuine failure re-holds with a concrete reason. This is
  // a no-op once no such rows remain.
  await prisma.newsItem.updateMany({
    where: { aiStatus: 'HELD', aiHoldReason: 'unknown' },
    data: { aiStatus: 'PENDING', aiAttempts: 0, aiHoldReason: null },
  })

  // Mostly newest-first so the visible top of the feed gets summaries, with
  // a small oldest-first lane so backlog left over from budget-exhausted
  // stretches still drains instead of being starved forever.
  const freshQuota = Math.max(1, Math.floor(limit * 0.8))
  const fresh = await prisma.newsItem.findMany({
    where: { aiStatus: 'PENDING' },
    orderBy: { publishedAt: 'desc' },
    take: freshQuota,
  })
  const backlogQuota = limit - fresh.length
  const backlog =
    backlogQuota > 0
      ? await prisma.newsItem.findMany({
          where: { aiStatus: 'PENDING', id: { notIn: fresh.map((f) => f.id) } },
          orderBy: { publishedAt: 'asc' },
          take: backlogQuota,
        })
      : []
  const pending = [...fresh, ...backlog]

  const report: SummarizeReport = {
    processed: pending.length,
    published: 0,
    held: 0,
    deferred: 0,
    model: provider.model,
  }

  let budgetExhausted = false
  for (const [index, item] of pending.entries()) {
    if (item.aiAttempts >= MAX_AI_ATTEMPTS) {
      // Legacy row that reached MAX via the old deferral inflation without
      // a real analysis: reset so a later run gets a genuine attempt. Needs
      // no provider call, so it runs even when the budget is exhausted.
      await prisma.newsItem.update({ where: { id: item.id }, data: { aiAttempts: 0 } })
      report.deferred += 1
      continue
    }
    if (budgetExhausted) {
      // The daily cap applies to every remaining item — count them as
      // deferred without a budget upsert+refund round-trip each.
      report.deferred += pending.length - index
      break
    }
    let attempts = item.aiAttempts
    let lastReason = 'unknown'
    let published = false
    let deferred = false

    while (attempts < MAX_AI_ATTEMPTS && !published && !deferred) {
      // Claim the attempt atomically (compare-and-swap on aiAttempts) so a
      // concurrent run — the ingest cron's inline summarize, an admin
      // trigger — never analyzes the same row twice.
      const claimed = await prisma.newsItem.updateMany({
        where: { id: item.id, aiStatus: 'PENDING', aiAttempts: attempts },
        data: { aiAttempts: { increment: 1 } },
      })
      if (claimed.count === 0) {
        // Another worker owns this row now — leave it to them.
        deferred = true
        break
      }
      attempts += 1
      try {
        await consumeAiBudget(1, { reserve: true })
        const analysis = await provider.analyzeArticle({
          title: item.title,
          source: item.source,
          category: item.category,
        })
        // Same pacing the brief/report generators use between provider calls.
        await aiCallSpacing()
        const sanity = sanityCheck(analysis, item.title)
        if (sanity.ok) {
          await prisma.newsItem.update({
            where: { id: item.id },
            data: {
              aiStatus: 'PUBLISHED',
              summaryKo: analysis.summary_ko.trim(),
              summaryEn: analysis.summary_en.trim(),
              sentiment:
                analysis.sentiment === 'bullish'
                  ? 'BULLISH'
                  : analysis.sentiment === 'bearish'
                    ? 'BEARISH'
                    : 'NEUTRAL',
              confidence: Math.round(analysis.confidence),
              aiModel: provider.model,
              aiAttempts: attempts,
              aiHoldReason: null,
            },
          })
          report.published += 1
          published = true
        } else {
          lastReason = sanity.reason
        }
      } catch (error) {
        if (error instanceof AiRateLimitError || error instanceof AiBudgetExceededError) {
          // No provider call happened: release the claim so this does NOT
          // count as an attempt (budget-starved items used to inflate to
          // MAX across runs and get held without ever being analyzed).
          attempts -= 1
          await prisma.newsItem.update({
            where: { id: item.id },
            data: { aiAttempts: attempts },
          })
          report.deferred += 1
          deferred = true
          if (error instanceof AiBudgetExceededError) budgetExhausted = true
        } else {
          lastReason = `provider error: ${String((error as Error).message).slice(0, 120)}`
        }
      }
    }

    if (!published && !deferred) {
      if (lastReason === 'unknown') {
        // The while loop never ran (aiAttempts arrived at MAX via legacy
        // deferral inflation) — nothing was actually tried this pass. Reset
        // instead of holding sight-unseen; a later run gets a real attempt.
        await prisma.newsItem.update({
          where: { id: item.id },
          data: { aiAttempts: 0 },
        })
        report.deferred += 1
      } else {
        await prisma.newsItem.update({
          where: { id: item.id },
          data: { aiStatus: 'HELD', aiAttempts: attempts, aiHoldReason: lastReason },
        })
        report.held += 1
      }
    }
  }

  return report
}

// ---------------------------------------------------------------------------
// Aggregate market sentiment from published articles (news-tone analysis)
// ---------------------------------------------------------------------------

export type MarketSentiment = {
  label: 'bullish' | 'neutral' | 'bearish'
  confidence: number
  sampleSize: number
  method: 'news-tone'
  windowHours: number
  /** publishedAt of the newest article in the sample (ISO) — the data's real age. */
  latestAt: string | null
}

export async function aggregateSentiment(windowHours = 24): Promise<MarketSentiment> {
  const since = new Date(Date.now() - windowHours * 3_600_000)
  const items = await prisma.newsItem.findMany({
    where: {
      aiStatus: 'PUBLISHED',
      publishedAt: { gte: since },
      sentiment: { not: null },
      confidence: { not: null },
    },
    select: { sentiment: true, confidence: true, publishedAt: true },
  })

  if (items.length === 0) {
    return {
      label: 'neutral',
      confidence: 0,
      sampleSize: 0,
      method: 'news-tone',
      windowHours,
      latestAt: null,
    }
  }

  let weighted = 0
  let totalWeight = 0
  let confidenceSum = 0
  let latest = 0
  for (const item of items) {
    const weight = item.confidence ?? 0
    totalWeight += weight
    confidenceSum += weight
    if (item.sentiment === 'BULLISH') weighted += weight
    if (item.sentiment === 'BEARISH') weighted -= weight
    latest = Math.max(latest, item.publishedAt.getTime())
  }

  const score = totalWeight > 0 ? weighted / totalWeight : 0
  const label = score > 0.15 ? 'bullish' : score < -0.15 ? 'bearish' : 'neutral'

  return {
    label,
    confidence: Math.round(confidenceSum / items.length),
    sampleSize: items.length,
    method: 'news-tone',
    windowHours,
    latestAt: latest ? new Date(latest).toISOString() : null,
  }
}
