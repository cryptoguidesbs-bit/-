import 'server-only'

import type { Prisma, ReportCadence, ReportCategory } from '@prisma/client'

import { getAiProvider, AiRateLimitError, type ReportGenInput } from '@/lib/ai/provider'
import { aiCallSpacing, consumeAiBudget, AiBudgetExceededError } from '@/lib/ai/budget'
import { dispatchWebhooks } from '@/lib/api/webhooks'
import { checkNarrativeText, type GuidelineResult } from '@/lib/brief/guidelines'
import { resilientFetch } from '@/lib/market/resilient'
import { cryptoSources, sentimentSources, type AssetQuote } from '@/lib/market/sources'
import { networkSources, stablecoinSources } from '@/lib/onchain/sources'
import { prisma } from '@/lib/prisma'

export const REPORT_CATEGORIES: ReportCategory[] = ['ETF', 'MACRO', 'ONCHAIN']

// ---------------------------------------------------------------------------
// Period keys — weekly (ISO week), monthly, quarterly
// ---------------------------------------------------------------------------

export function periodKeyFor(cadence: ReportCadence, date: Date): string {
  const year = date.getUTCFullYear()
  if (cadence === 'MONTHLY') {
    return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  }
  if (cadence === 'QUARTERLY') {
    return `${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`
  }
  // ISO week
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Review (검수) — automated expression review before publishing
// ---------------------------------------------------------------------------

export function reviewReport(content: {
  title: { ko: string; en: string }
  summary: { ko: string; en: string }
  content: { ko: string; en: string }
}): GuidelineResult {
  for (const lang of ['ko', 'en'] as const) {
    const title = checkNarrativeText(content.title[lang], lang, 'title', {
      minLen: 8,
      maxLen: 200,
      requireProbabilistic: false,
    })
    if (!title.ok) return title
    const summary = checkNarrativeText(content.summary[lang], lang, 'summary', {
      minLen: 40,
      maxLen: 1000,
    })
    if (!summary.ok) return summary
    const body = checkNarrativeText(content.content[lang], lang, 'content', {
      minLen: 200,
      maxLen: 20000,
    })
    if (!body.ok) return body
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

async function gatherInputs(): Promise<
  Omit<ReportGenInput, 'category' | 'cadence' | 'periodKey' | 'mockScenario'>
> {
  const [crypto, fng, network, stables, headlines] = await Promise.all([
    resilientFetch('crypto-prices', cryptoSources, { freshMs: 60_000 }),
    resilientFetch('sentiment', sentimentSources, { freshMs: 10 * 60_000 }),
    resilientFetch('onchain-network', networkSources, { freshMs: 10 * 60_000 }),
    resilientFetch('onchain-stablecoins', stablecoinSources, { freshMs: 10 * 60_000 }),
    prisma.newsItem.findMany({
      where: {
        aiStatus: 'PUBLISHED',
        publishedAt: { gte: new Date(Date.now() - 7 * 24 * 3_600_000) },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      select: { title: true, category: true },
    }),
  ])

  const net = network.data
  return {
    market: (crypto.data as AssetQuote[] | null) ?? [],
    fearGreed: fng.data
      ? {
          value: (fng.data as { value: number }).value,
          classification: (fng.data as { classification: string }).classification,
        }
      : null,
    headlines: headlines.map((h) => ({ title: h.title, category: h.category })),
    network: {
      activeAddresses: net ? Math.round(net.activeAddresses.latest) : null,
      transactions: net ? Math.round(net.transactions.latest) : null,
      hashRateEh: net ? Math.round(net.hashRate.latest / 1e6) : null,
      minerRevenueUsd: net ? Math.round(net.minerRevenue.latest) : null,
    },
    stablecoins: (stables.data ?? []).map((s) => ({
      symbol: s.symbol,
      marketCapB: Math.round(s.marketCap / 1e9),
    })),
  }
}

// ---------------------------------------------------------------------------
// Pipeline: generate (DRAFT) → review (검수) → publish or hold (IN_REVIEW)
// ---------------------------------------------------------------------------

export type ReportRunItem = {
  category: ReportCategory
  status: 'published' | 'held' | 'deferred' | 'skipped'
  slug: string
  reason?: string
}

export type ReportRunReport = {
  cadence: ReportCadence
  periodKey: string
  model: string
  items: ReportRunItem[]
}

export async function generateReports(options: {
  cadence: ReportCadence
  date?: Date
  mockScenario?: string
}): Promise<ReportRunReport> {
  const provider = getAiProvider()
  const date = options.date ?? new Date()
  const periodKey = periodKeyFor(options.cadence, date)
  const inputs = await gatherInputs()
  const items: ReportRunItem[] = []

  for (const category of REPORT_CATEGORIES) {
    const slug = `${category.toLowerCase()}-${options.cadence.toLowerCase()}-${periodKey}`.toLowerCase()

    // Idempotent per period: skip when a published row already exists.
    const existing = await prisma.report.findUnique({
      where: { slug_locale: { slug, locale: 'ko' } },
    })
    if (existing?.status === 'PUBLISHED') {
      items.push({ category, status: 'skipped', slug, reason: 'already published' })
      continue
    }

    try {
      await consumeAiBudget()
      const generated = await provider.generateReport({
        ...inputs,
        category,
        cadence: options.cadence,
        periodKey,
        mockScenario: options.mockScenario,
      })

      // 검수 (automated review)
      const review = reviewReport(generated)
      const base = {
        cadence: options.cadence,
        category,
        periodKey,
        aiModel: provider.model,
        isPremium: true,
      }

      for (const locale of ['ko', 'en'] as const) {
        const data = {
          ...base,
          title: generated.title[locale],
          summary: generated.summary[locale],
          content: generated.content[locale],
          status: review.ok ? ('PUBLISHED' as const) : ('IN_REVIEW' as const),
          publishedAt: review.ok ? new Date() : null,
          reviewNote: review.ok ? null : review.reason,
        }
        const row = await prisma.report.upsert({
          where: { slug_locale: { slug, locale } },
          update: data,
          create: { slug, locale, ...data },
        })

        // Audit trail: every review outcome, publishes additionally logged.
        await prisma.contentAuditLog.create({
          data: {
            action: 'REVIEW',
            contentType: 'REPORT',
            contentId: row.id,
            reportId: row.id,
            diff: {
              slug,
              locale,
              outcome: review.ok ? 'approved' : 'held',
              ...(review.ok ? {} : { reason: review.reason }),
            } as unknown as Prisma.InputJsonValue,
            reason: 'automated expression review',
          },
        })
        if (review.ok) {
          await prisma.contentAuditLog.create({
            data: {
              action: 'PUBLISH',
              contentType: 'REPORT',
              contentId: row.id,
              reportId: row.id,
              diff: {
                slug,
                locale,
                cadence: options.cadence,
                category,
                periodKey,
                model: provider.model,
              } as unknown as Prisma.InputJsonValue,
              reason: 'auto-generated premium research (non-personalized)',
            },
          })

          // API Center webhooks (stage 18) — fire-and-forget notification.
          await dispatchWebhooks('report.published', {
            slug,
            locale,
            cadence: options.cadence,
            category,
            periodKey,
          }).catch(() => {})
        }
      }

      items.push(
        review.ok
          ? { category, status: 'published', slug }
          : { category, status: 'held', slug, reason: review.reason },
      )
    } catch (error) {
      if (error instanceof AiBudgetExceededError || error instanceof AiRateLimitError) {
        items.push({ category, status: 'deferred', slug, reason: (error as Error).message })
      } else {
        items.push({
          category,
          status: 'held',
          slug,
          reason: `provider error: ${String((error as Error).message).slice(0, 120)}`,
        })
      }
    }
    await aiCallSpacing()
  }

  return { cadence: options.cadence, periodKey, model: provider.model, items }
}
