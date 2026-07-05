import 'server-only'

import { createHash } from 'node:crypto'
import type { NewsCategory } from '@prisma/client'

import { MAX_ITEMS_PER_SOURCE, newsSources } from '@/config/news-sources'
import { getAiProvider, AiRateLimitError } from '@/lib/ai/provider'
import { consumeAiBudget, AiBudgetExceededError } from '@/lib/ai/budget'
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
    pattern: /\b(fed|cpi|inflation|interest rate|treasury|macro|recession|gdp|dollar)\b|연준|금리|물가/i,
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
    }),
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
  const pending = await prisma.newsItem.findMany({
    where: { aiStatus: 'PENDING' },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  })

  const report: SummarizeReport = {
    processed: pending.length,
    published: 0,
    held: 0,
    deferred: 0,
    model: provider.model,
  }

  for (const item of pending) {
    let attempts = item.aiAttempts
    let lastReason = 'unknown'
    let published = false
    let deferred = false

    while (attempts < MAX_AI_ATTEMPTS && !published && !deferred) {
      attempts += 1
      try {
        await consumeAiBudget()
        const analysis = await provider.analyzeArticle({
          title: item.title,
          source: item.source,
          category: item.category,
        })
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
          // Back off (rate limit / daily cost cap): keep PENDING for a later run.
          await prisma.newsItem.update({
            where: { id: item.id },
            data: { aiAttempts: attempts },
          })
          report.deferred += 1
          deferred = true
        } else {
          lastReason = `provider error: ${String((error as Error).message).slice(0, 120)}`
        }
      }
    }

    if (!published && !deferred) {
      await prisma.newsItem.update({
        where: { id: item.id },
        data: { aiStatus: 'HELD', aiAttempts: attempts, aiHoldReason: lastReason },
      })
      report.held += 1
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
    select: { sentiment: true, confidence: true },
  })

  if (items.length === 0) {
    return { label: 'neutral', confidence: 0, sampleSize: 0, method: 'news-tone', windowHours }
  }

  let weighted = 0
  let totalWeight = 0
  let confidenceSum = 0
  for (const item of items) {
    const weight = item.confidence ?? 0
    totalWeight += weight
    confidenceSum += weight
    if (item.sentiment === 'BULLISH') weighted += weight
    if (item.sentiment === 'BEARISH') weighted -= weight
  }

  const score = totalWeight > 0 ? weighted / totalWeight : 0
  const label = score > 0.15 ? 'bullish' : score < -0.15 ? 'bearish' : 'neutral'

  return {
    label,
    confidence: Math.round(confidenceSum / items.length),
    sampleSize: items.length,
    method: 'news-tone',
    windowHours,
  }
}
