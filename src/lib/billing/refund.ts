import 'server-only'

import type { Subscription } from '@prisma/client'

import { ANNUAL_REFUND_WINDOW_DAYS } from '@/lib/payments/plans'
import { hasUsedSince } from './usage'

// ---------------------------------------------------------------------------
// Annual-only full refund: within 14 days of purchase AND the service was
// never used (no login/content-access record since the period start).
// Monthly plans are not refundable (cancel at period end instead).
// ---------------------------------------------------------------------------

export type RefundEligibility = {
  eligible: boolean
  reason: 'ok' | 'not-annual' | 'window-passed' | 'used' | 'no-subscription' | 'already-refunded'
  windowEndsAt: Date | null
}

export async function checkAnnualRefundEligibility(
  sub: Subscription | null,
): Promise<RefundEligibility> {
  if (!sub || sub.plan === 'FREE' || !sub.externalId) {
    return { eligible: false, reason: 'no-subscription', windowEndsAt: null }
  }
  if (sub.refundedAt) {
    return { eligible: false, reason: 'already-refunded', windowEndsAt: null }
  }
  if (sub.interval !== 'YEARLY') {
    return { eligible: false, reason: 'not-annual', windowEndsAt: null }
  }

  const start = sub.currentPeriodStart ?? sub.createdAt
  const windowEndsAt = new Date(start.getTime() + ANNUAL_REFUND_WINDOW_DAYS * 86_400_000)
  if (Date.now() > windowEndsAt.getTime()) {
    return { eligible: false, reason: 'window-passed', windowEndsAt }
  }

  if (await hasUsedSince(sub.userId, start)) {
    return { eligible: false, reason: 'used', windowEndsAt }
  }

  return { eligible: true, reason: 'ok', windowEndsAt }
}
