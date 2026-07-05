import 'server-only'

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// LLM cost / rate-limit management.
// - Hard daily call budget (AI_DAILY_CALL_LIMIT, default 200) tracked in the
//   AiUsage table — callers must consume budget BEFORE calling the model.
// - Token usage is recorded per day for cost visibility.
// - A minimum spacing between calls avoids bursting into provider rate
//   limits during batch jobs.
// ---------------------------------------------------------------------------

export class AiBudgetExceededError extends Error {
  constructor(limit: number) {
    super(`daily AI call limit reached (${limit})`)
  }
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function dailyLimit(): number {
  const parsed = Number(process.env.AI_DAILY_CALL_LIMIT)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200
}

/** Reserve one model call from today's budget. Throws when exhausted. */
export async function consumeAiBudget(calls = 1): Promise<void> {
  const limit = dailyLimit()
  const day = todayUtc()
  const usage = await prisma.aiUsage.upsert({
    where: { day },
    update: { calls: { increment: calls } },
    create: { day, calls },
  })
  if (usage.calls > limit) {
    throw new AiBudgetExceededError(limit)
  }
}

/** Record token usage for cost tracking (best effort). */
export async function recordAiTokens(inputTokens: number, outputTokens: number): Promise<void> {
  const day = todayUtc()
  await prisma.aiUsage
    .upsert({
      where: { day },
      update: {
        inputTokens: { increment: Math.max(0, Math.round(inputTokens)) },
        outputTokens: { increment: Math.max(0, Math.round(outputTokens)) },
      },
      create: {
        day,
        inputTokens: Math.max(0, Math.round(inputTokens)),
        outputTokens: Math.max(0, Math.round(outputTokens)),
      },
    })
    .catch(() => {})
}

/** Small spacing between consecutive model calls in batch jobs. */
export function aiCallSpacing(): Promise<void> {
  const ms = Number(process.env.AI_CALL_SPACING_MS ?? 400)
  return new Promise((resolve) => setTimeout(resolve, Number.isFinite(ms) ? ms : 400))
}
