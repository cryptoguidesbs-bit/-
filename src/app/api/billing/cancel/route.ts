import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { getPaymentProvider } from '@/lib/payments'
import { syncSubscriptionToDb } from '@/lib/payments/sync'
import { prisma } from '@/lib/prisma'

// Cancels the signed-in user's subscription at the end of the current
// billing period.
export async function POST() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: true },
  })
  if (!user?.subscription?.externalId) {
    return NextResponse.json({ error: 'no subscription' }, { status: 404 })
  }

  try {
    const data = await getPaymentProvider().cancelSubscription(user.subscription.externalId, {
      atPeriodEnd: true,
    })
    await syncSubscriptionToDb(user.id, data)
    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      currentPeriodEnd: data.currentPeriodEnd,
    })
  } catch (error) {
    console.error('[billing/cancel]', error)
    return NextResponse.json({ error: 'cancel failed' }, { status: 500 })
  }
}
