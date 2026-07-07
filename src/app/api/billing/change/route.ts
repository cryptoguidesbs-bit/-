import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { getPaymentProvider } from '@/lib/payments'
import { changeDirection, paidPlans, priceEnvVar, type PaidPlanKey } from '@/lib/payments/plans'
import { syncSubscriptionToDb } from '@/lib/payments/sync'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { logSecurityEvent } from '@/lib/security/audit'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  plan: z.enum(paidPlans as unknown as [PaidPlanKey, ...PaidPlanKey[]]),
  interval: z.enum(['monthly', 'yearly']),
})

const DB_TO_KEY: Record<string, PaidPlanKey | 'free'> = {
  FREE: 'free',
  STANDARD: 'standard',
  PROFESSIONAL: 'professional',
  INSTITUTIONAL: 'institutional',
  LEGENDARY: 'legendary',
}
const DB_INTERVAL = { MONTHLY: 'monthly', YEARLY: 'yearly' } as const

// POST /api/billing/change — switch plan/interval.
//   upgrade   → applied immediately, prorated difference charged now
//   downgrade → scheduled for the current period end (no refund now)
export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limited = enforceRateLimit({ name: 'plan-change', limit: 10, identifier: clerkId, request })
  if (limited) return limited

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid plan' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { clerkId }, include: { subscription: true } })
  const sub = user?.subscription
  if (!user || !sub?.externalId || sub.plan === 'FREE') {
    return NextResponse.json({ error: 'no active subscription' }, { status: 404 })
  }

  const currentKey = DB_TO_KEY[sub.plan]
  const currentInterval = sub.interval ? DB_INTERVAL[sub.interval] : 'monthly'
  if (currentKey === 'free') {
    return NextResponse.json({ error: 'no active subscription' }, { status: 404 })
  }

  const direction = changeDirection(
    { plan: currentKey, interval: currentInterval },
    { plan: parsed.data.plan, interval: parsed.data.interval },
  )
  if (direction === 'same') {
    return NextResponse.json({ error: 'already on this plan' }, { status: 409 })
  }

  const newPriceId = process.env[priceEnvVar[parsed.data.plan][parsed.data.interval]]
  if (!newPriceId) {
    return NextResponse.json({ error: 'price not configured' }, { status: 500 })
  }

  try {
    if (direction === 'upgrade') {
      // Immediate switch + prorated difference invoiced now.
      const live = await getPaymentProvider().getSubscription(sub.externalId)
      if (!live.itemId) {
        return NextResponse.json({ error: 'subscription item missing' }, { status: 500 })
      }
      const updated = await getPaymentProvider().switchPrice({
        subscriptionId: sub.externalId,
        itemId: live.itemId,
        newPriceId,
        prorate: true,
      })
      await syncSubscriptionToDb(user.id, updated)
    } else {
      // Downgrade: defer to the period end (no refund now). Recorded in our
      // DB and applied by the invoice.upcoming webhook at renewal.
      await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          pendingPlan: parsed.data.plan.toUpperCase() as never,
          pendingInterval: parsed.data.interval.toUpperCase() as never,
        },
      })
    }

    await logSecurityEvent({
      action: `billing.${direction}`,
      userId: user.id,
      actorEmail: user.email,
      request,
      meta: { from: `${currentKey}/${currentInterval}`, to: `${parsed.data.plan}/${parsed.data.interval}` },
    })

    return NextResponse.json({
      ok: true,
      direction,
      appliesAt: direction === 'upgrade' ? 'now' : 'period_end',
      effectiveDate: direction === 'upgrade' ? new Date() : sub.currentPeriodEnd,
    })
  } catch (error) {
    console.error('[billing/change]', error)
    return NextResponse.json({ error: 'plan change failed' }, { status: 500 })
  }
}
