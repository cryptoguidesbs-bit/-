import 'server-only'

import type { SubscriptionPlan } from '@prisma/client'

import { isFeatureAllowedInCountryLive } from '@/lib/entitlements/region'
import { REFERRAL } from '@/config/referral'
import { planAmounts } from '@/lib/payments/plans'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Referral qualification — a PENDING referral becomes QUALIFIED when the
// referred user holds an entitled paid subscription. Commission (10% of the
// plan's monthly base) accrues only if the REFERRER's stored country passes
// the 'referral.rewards' region policy; otherwise the referral qualifies
// for ranking purposes but no monetary reward is created.
// ---------------------------------------------------------------------------

const ENTITLED_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE']

const MONTHLY_BY_PLAN: Partial<Record<SubscriptionPlan, number>> = {
  STARTER: planAmounts.starter.monthly,
  TRADER: planAmounts.trader.monthly,
  PRO: planAmounts.pro.monthly,
  WHALE: planAmounts.whale.monthly,
}

export type QualifyOutcome = 'qualified' | 'qualified-noreward' | 'skipped'

/** Qualify the referral (if any) of one referred user. Idempotent. */
export async function qualifyReferral(referredUserId: string): Promise<QualifyOutcome> {
  const referral = await prisma.referral.findUnique({
    where: { referredUserId },
    include: {
      referred: { include: { subscription: true } },
      referrer: { select: { id: true, country: true } },
    },
  })
  if (!referral || referral.status !== 'PENDING') return 'skipped'

  const sub = referral.referred.subscription
  const monthly = sub ? MONTHLY_BY_PLAN[sub.plan] : undefined
  if (!sub || !monthly || !ENTITLED_STATUSES.includes(sub.status)) return 'skipped'

  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: 'QUALIFIED', qualifiedAt: new Date() },
  })

  // Region policy on the REFERRER — monetary rewards may be regulated in
  // their jurisdiction (docs/legal-review.md).
  if (!(await isFeatureAllowedInCountryLive('referral.rewards', referral.referrer.country))) {
    return 'qualified-noreward'
  }

  const amountUsd = Math.round(monthly * REFERRAL.commissionRate * 100) / 100
  await prisma.referralReward.create({
    data: {
      userId: referral.referrer.id,
      referralId: referral.id,
      amountUsd,
      note: `commission ${Math.round(REFERRAL.commissionRate * 100)}% of ${sub.plan} monthly`,
    },
  })
  return 'qualified'
}

export type QualifySummary = {
  scanned: number
  qualified: number
  rewarded: number
}

/** Reconciliation sweep over all PENDING referrals (cron/admin). */
export async function qualifyPendingReferrals(): Promise<QualifySummary> {
  const pending = await prisma.referral.findMany({
    where: { status: 'PENDING' },
    select: { referredUserId: true },
  })

  const summary: QualifySummary = { scanned: pending.length, qualified: 0, rewarded: 0 }
  for (const { referredUserId } of pending) {
    const outcome = await qualifyReferral(referredUserId)
    if (outcome === 'qualified') {
      summary.qualified += 1
      summary.rewarded += 1
    } else if (outcome === 'qualified-noreward') {
      summary.qualified += 1
    }
  }
  return summary
}
