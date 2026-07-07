import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

import { getPaymentProvider, isPaidPlan } from '@/lib/payments'
import { TRIAL_PERIOD_DAYS } from '@/lib/payments/plans'
import { routing } from '@/i18n/routing'
import { siteUrl } from '@/lib/site'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/prisma'

// Creates a hosted checkout session for the signed-in user and returns its
// URL. Body: { plan, interval, locale }.
export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const limited = enforceRateLimit({ name: 'checkout', limit: 10, identifier: clerkId, request })
  if (limited) return limited

  const body = (await request.json().catch(() => ({}))) as {
    plan?: string
    interval?: string
    locale?: string
  }

  if (!body.plan || !isPaidPlan(body.plan)) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }
  const interval = body.interval === 'yearly' ? 'yearly' : 'monthly'
  const locale = routing.locales.includes(body.locale as (typeof routing.locales)[number])
    ? (body.locale as string)
    : routing.defaultLocale

  // Resolve our internal user (created at consent time; self-heal if missing).
  let user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) {
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(clerkId)
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
      return NextResponse.json({ error: 'no email on account' }, { status: 400 })
    }
    user = await prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, email, locale },
    })
  }

  // Already on an active paid plan → send them to billing management instead
  // of double-subscribing.
  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (
    existing &&
    existing.plan !== 'FREE' &&
    (existing.status === 'ACTIVE' || existing.status === 'TRIALING' || existing.status === 'PAST_DUE')
  ) {
    return NextResponse.json({ error: 'already subscribed', code: 'ALREADY_SUBSCRIBED' }, { status: 409 })
  }

  try {
    const checkout = await getPaymentProvider().createCheckout({
      plan: body.plan,
      interval,
      userId: user.id,
      email: user.email,
      successUrl: `${siteUrl}/${locale}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl}/${locale}/#pricing`,
      locale,
      // 7-day free trial before the first charge.
      trialPeriodDays: TRIAL_PERIOD_DAYS,
    })
    return NextResponse.json({ url: checkout.url, id: checkout.id })
  } catch (error) {
    console.error('[billing/checkout]', error)
    return NextResponse.json({ error: 'checkout failed' }, { status: 500 })
  }
}
