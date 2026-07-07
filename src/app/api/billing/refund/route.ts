import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { getPaymentProvider } from '@/lib/payments'
import { checkAnnualRefundEligibility } from '@/lib/billing/refund'
import { syncSubscriptionToDb } from '@/lib/payments/sync'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { logSecurityEvent } from '@/lib/security/audit'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/billing/refund — annual refund eligibility (14-day, unused).
export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId }, include: { subscription: true } })
  const eligibility = await checkAnnualRefundEligibility(user?.subscription ?? null)
  return NextResponse.json(eligibility)
}

// POST /api/billing/refund — issue the full refund if eligible, then cancel.
export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limited = enforceRateLimit({ name: 'refund', limit: 5, identifier: clerkId, request })
  if (limited) return limited

  const user = await prisma.user.findUnique({ where: { clerkId }, include: { subscription: true } })
  const sub = user?.subscription
  if (!user || !sub?.externalId) {
    return NextResponse.json({ error: 'no subscription' }, { status: 404 })
  }

  const eligibility = await checkAnnualRefundEligibility(sub)
  if (!eligibility.eligible) {
    return NextResponse.json({ error: 'not eligible', reason: eligibility.reason }, { status: 409 })
  }

  try {
    const refund = await getPaymentProvider().refundSubscription(sub.externalId)

    // Cancel immediately (refund revokes access) and stamp the refund.
    const canceled = await getPaymentProvider().getSubscription(sub.externalId).catch(() => null)
    if (canceled) await syncSubscriptionToDb(user.id, canceled)
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { refundedAt: new Date(), status: 'CANCELED' },
    })

    await logSecurityEvent({
      action: 'billing.refund',
      userId: user.id,
      actorEmail: user.email,
      request,
      meta: { amount: refund.amount, currency: refund.currency, refundId: refund.refundId },
    })

    return NextResponse.json({ ok: true, refunded: refund.amount, currency: refund.currency })
  } catch (error) {
    console.error('[billing/refund]', error)
    return NextResponse.json({ error: 'refund failed' }, { status: 500 })
  }
}
