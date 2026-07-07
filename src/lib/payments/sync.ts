import type {
  SubscriptionInterval as DbInterval,
  SubscriptionPlan as DbPlan,
  SubscriptionStatus as DbStatus,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { qualifyReferral } from '@/lib/referral/qualify'
import type { PaidPlanKey, SubscriptionData, SubscriptionStatus } from './types'

const PLAN_MAP: Record<PaidPlanKey, DbPlan> = {
  standard: 'STANDARD',
  professional: 'PROFESSIONAL',
  institutional: 'INSTITUTIONAL',
  legendary: 'LEGENDARY',
}

const STATUS_MAP: Record<SubscriptionStatus, DbStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  expired: 'EXPIRED',
  incomplete: 'INCOMPLETE',
}

// Persist a provider subscription snapshot onto our Subscription table.
// `userId` is OUR user id (echoed through provider metadata).
export async function syncSubscriptionToDb(userId: string, sub: SubscriptionData) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const interval: DbInterval | null =
    sub.interval === 'monthly' ? 'MONTHLY' : sub.interval === 'yearly' ? 'YEARLY' : null
  const plan: DbPlan = sub.plan ? PLAN_MAP[sub.plan] : ('FREE' as DbPlan)

  // Clear a scheduled downgrade once the provider has switched to it.
  const existing = await prisma.subscription.findUnique({ where: { userId } })
  const clearPending =
    existing?.pendingPlan &&
    existing.pendingPlan === plan &&
    existing.pendingInterval === interval

  const data = {
    plan,
    status: STATUS_MAP[sub.status],
    interval,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    externalId: sub.id,
    externalCustomerId: sub.customerId,
    ...(clearPending ? { pendingPlan: null, pendingInterval: null } : {}),
  }

  const saved = await prisma.subscription.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  })

  // First paid subscription may qualify a pending referral (stage 17).
  // Never let referral bookkeeping break payment sync.
  if (data.plan !== 'FREE' && ['ACTIVE', 'TRIALING'].includes(data.status)) {
    await qualifyReferral(userId).catch(() => {})
  }

  return saved
}
