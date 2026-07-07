import 'server-only'

import type { BriefTier, Prisma } from '@prisma/client'

import { getAiProvider, AiRateLimitError, type BriefGenInput } from '@/lib/ai/provider'
import {
  aiCallSpacing,
  consumeAiBudget,
  AiBudgetExceededError,
} from '@/lib/ai/budget'
import { dispatchWebhooks } from '@/lib/api/webhooks'
import { checkGuidelines, type BriefSections } from '@/lib/brief/guidelines'
import { resilientFetch } from '@/lib/market/resilient'
import { cryptoSources, sentimentSources, type AssetQuote } from '@/lib/market/sources'
import { prisma } from '@/lib/prisma'

const MAX_ATTEMPTS = 2

// ---------------------------------------------------------------------------
// Input gathering — market snapshot + recent published headlines
// ---------------------------------------------------------------------------

async function gatherInputs(): Promise<Omit<BriefGenInput, 'tier' | 'date' | 'mockScenario'>> {
  const [crypto, fng, headlines] = await Promise.all([
    resilientFetch('crypto-prices', cryptoSources, { freshMs: 60_000 }),
    resilientFetch('sentiment', sentimentSources, { freshMs: 10 * 60_000 }),
    prisma.newsItem.findMany({
      where: {
        aiStatus: 'PUBLISHED',
        publishedAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
      },
      orderBy: { publishedAt: 'desc' },
      take: 12,
      select: { title: true, category: true, sentiment: true },
    }),
  ])

  return {
    market: (crypto.data as AssetQuote[] | null) ?? [],
    fearGreed: fng.data
      ? {
          value: (fng.data as { value: number }).value,
          classification: (fng.data as { classification: string }).classification,
        }
      : null,
    headlines: headlines.map((h) => ({
      title: h.title,
      category: h.category,
      sentiment: h.sentiment,
    })),
  }
}

// ---------------------------------------------------------------------------
// Generation — per tier: budget → model → guideline check → publish or hold
// ---------------------------------------------------------------------------

export type BriefTierReport = {
  tier: BriefTier
  status: 'published' | 'held' | 'deferred' | 'skipped'
  attempts: number
  reason?: string
}

export type GenerateReport = {
  date: string
  model: string
  tiers: BriefTierReport[]
}

async function generateTier(
  date: string,
  tier: BriefTier,
  inputs: Omit<BriefGenInput, 'tier' | 'date' | 'mockScenario'>,
  mockScenario?: string,
): Promise<BriefTierReport> {
  const provider = getAiProvider()

  // Already published for this date/tier → idempotent skip.
  const existing = await prisma.marketBrief.findUnique({
    where: { briefDate_tier: { briefDate: date, tier } },
  })
  if (existing?.status === 'PUBLISHED') {
    return { tier, status: 'skipped', attempts: existing.attempts, reason: 'already published' }
  }

  let attempts = 0
  let lastReason = 'unknown'

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      await consumeAiBudget()
      const sections = await provider.generateBrief({
        ...inputs,
        tier: tier === 'DETAILED' ? 'detailed' : 'standard',
        date,
        mockScenario,
      })

      const verdict = checkGuidelines(sections as BriefSections)
      if (verdict.ok) {
        const brief = await prisma.marketBrief.upsert({
          where: { briefDate_tier: { briefDate: date, tier } },
          update: {
            status: 'PUBLISHED',
            sections: sections as unknown as Prisma.InputJsonValue,
            inputsSnapshot: {
              market: inputs.market,
              fearGreed: inputs.fearGreed,
              headlineCount: inputs.headlines.length,
            } as unknown as Prisma.InputJsonValue,
            aiModel: provider.model,
            attempts,
            holdReason: null,
          },
          create: {
            briefDate: date,
            tier,
            status: 'PUBLISHED',
            sections: sections as unknown as Prisma.InputJsonValue,
            inputsSnapshot: {
              market: inputs.market,
              fearGreed: inputs.fearGreed,
              headlineCount: inputs.headlines.length,
            } as unknown as Prisma.InputJsonValue,
            aiModel: provider.model,
            attempts,
          },
        })

        // Append-only audit trail for every published brief.
        await prisma.contentAuditLog.create({
          data: {
            action: 'PUBLISH',
            contentType: 'BRIEF',
            contentId: brief.id,
            diff: {
              briefDate: date,
              tier,
              model: provider.model,
              attempts,
              sections: Object.keys(sections),
            } as unknown as Prisma.InputJsonValue,
            reason: 'auto-generated market brief (non-personalized)',
          },
        })

        // API Center webhooks (stage 18) — fire-and-forget notification.
        await dispatchWebhooks('brief.published', { briefDate: date, tier }).catch(() => {})

        return { tier, status: 'published', attempts }
      }
      lastReason = verdict.reason
    } catch (error) {
      if (error instanceof AiBudgetExceededError || error instanceof AiRateLimitError) {
        // Cost / rate-limit control: defer — a later run retries.
        return { tier, status: 'deferred', attempts, reason: (error as Error).message }
      }
      lastReason = `provider error: ${String((error as Error).message).slice(0, 120)}`
    }
    await aiCallSpacing()
  }

  await prisma.marketBrief.upsert({
    where: { briefDate_tier: { briefDate: date, tier } },
    update: { status: 'HELD', attempts, holdReason: lastReason, aiModel: provider.model },
    create: {
      briefDate: date,
      tier,
      status: 'HELD',
      sections: {} as Prisma.InputJsonValue,
      aiModel: provider.model,
      attempts,
      holdReason: lastReason,
    },
  })
  return { tier, status: 'held', attempts, reason: lastReason }
}

export async function generateDailyBriefs(options: {
  date?: string
  mockScenario?: string
}): Promise<GenerateReport> {
  const date = options.date ?? new Date().toISOString().slice(0, 10)
  const provider = getAiProvider()
  const inputs = await gatherInputs()

  const tiers: BriefTierReport[] = []
  for (const tier of ['STANDARD', 'DETAILED'] as BriefTier[]) {
    tiers.push(await generateTier(date, tier, inputs, options.mockScenario))
    await aiCallSpacing()
  }

  return { date, model: provider.model, tiers }
}
