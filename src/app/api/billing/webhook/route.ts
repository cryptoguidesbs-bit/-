import { NextRequest, NextResponse } from 'next/server'

import { getPaymentProvider } from '@/lib/payments'
import { syncSubscriptionToDb } from '@/lib/payments/sync'

// Payment provider webhook (Stripe: checkout.session.completed +
// customer.subscription.*). Signature is verified by the provider; events are
// normalized before being applied to the Subscription table.
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  }

  const rawBody = await request.text()

  let event
  try {
    event = await getPaymentProvider().parseWebhook(rawBody, signature)
  } catch (error) {
    console.error('[billing/webhook] signature verification failed', error)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  if (event.type === 'ignored') {
    return NextResponse.json({ received: true })
  }

  const { userId, subscription } = event
  if (userId && subscription) {
    await syncSubscriptionToDb(userId, subscription)
  }

  return NextResponse.json({ received: true })
}
