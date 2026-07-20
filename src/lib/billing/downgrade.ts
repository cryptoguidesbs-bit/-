import 'server-only'

import type { SubscriptionInterval, SubscriptionPlan } from '@prisma/client'

import { getPaymentProvider } from '@/lib/payments'
import { priceEnvVar, type BillingInterval, type PaidPlanKey } from '@/lib/payments/plans'
import { syncSubscriptionToDb } from '@/lib/payments/sync'
import { prisma } from '@/lib/prisma'

const PLAN_KEY: Record<Exclude<SubscriptionPlan, 'FREE'>, PaidPlanKey> = {
  STARTER: 'starter',
  TRADER: 'trader',
  PRO: 'pro',
  WHALE: 'whale',
}
const INTERVAL_KEY: Record<SubscriptionInterval, BillingInterval> = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
}

// Apply a scheduled downgrade at renewal (driven by invoice.upcoming). The
// price switches with no proration so the upcoming period bills the lower
// plan; pending fields are cleared by the subsequent sync.
export async function applyPendingDowngradeForCustomer(customerId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: { externalCustomerId: customerId, pendingPlan: { not: null } },
  })
  if (!sub?.externalId || !sub.pendingPlan || sub.pendingPlan === 'FREE') return false

  const planKey = PLAN_KEY[sub.pendingPlan as Exclude<SubscriptionPlan, 'FREE'>]
  const intervalKey = INTERVAL_KEY[sub.pendingInterval ?? 'MONTHLY']
  const newPriceId = process.env[priceEnvVar[planKey][intervalKey]]
  if (!newPriceId) return false

  const live = await getPaymentProvider().getSubscription(sub.externalId)
  if (!live.itemId) return false

  const updated = await getPaymentProvider().switchPrice({
    subscriptionId: sub.externalId,
    itemId: live.itemId,
    newPriceId,
    prorate: false,
  })
  await syncSubscriptionToDb(sub.userId, updated) // clears pending (plan now matches)
  return true
}
