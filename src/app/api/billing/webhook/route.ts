import { NextRequest, NextResponse } from 'next/server'

import { getPaymentProvider } from '@/lib/payments'
import { syncSubscriptionToDb } from '@/lib/payments/sync'
import { sendRenewalReminder } from '@/lib/billing/reminders'
import { applyPendingDowngradeForCustomer } from '@/lib/billing/downgrade'

// Payment provider webhook (Stripe). Signature is verified by the provider;
// events are normalized before being applied:
//   checkout.completed / subscription.*  → sync the Subscription row
//   invoice.upcoming                      → 3-day-before renewal reminder
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

  if (event.type === 'invoice.upcoming') {
    // Apply any scheduled downgrade before renewal (bills the lower plan),
    // then send the renewal reminder.
    if (event.customerId) {
      await applyPendingDowngradeForCustomer(event.customerId).catch(() => {})
    }
    await sendRenewalReminder({
      customerId: event.customerId,
      amountDue: event.amountDue,
      currency: event.currency,
      renewalAt: event.renewalAt,
    })
    return NextResponse.json({ received: true })
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
