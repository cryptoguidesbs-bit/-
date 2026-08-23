import { NextRequest, NextResponse } from 'next/server'
import { recordEvent } from '@/lib/events'
import { z } from 'zod'

import { paidPlans } from '@/lib/payments/plans'
import { routing } from '@/i18n/routing'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Paid-plan waitlist for the free-first launch (payments disabled — no LLC,
// so Stripe live cannot be activated yet). Public; abuse is bounded by an IP
// rate limit. One row per email — repeat submits update the plan interest.
const waitlistSchema = z.object({
  email: z.string().trim().email().max(200),
  plan: z.string().optional(),
  locale: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit({ name: 'waitlist', limit: 10, request })
  if (limited) return limited

  const parsed = waitlistSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid signup' }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase()
  const plan = (paidPlans as readonly string[]).includes(parsed.data.plan ?? '')
    ? parsed.data.plan
    : null
  const locale = routing.locales.includes(parsed.data.locale as (typeof routing.locales)[number])
    ? (parsed.data.locale as string)
    : routing.defaultLocale

  await prisma.waitlistSignup.upsert({
    where: { email },
    // Never let a repeat submit blank out a previously recorded plan.
    update: { ...(plan ? { plan } : {}), locale },
    create: { email, plan, locale },
  })

  await recordEvent({ name: 'waitlist_signup', locale, meta: { plan: plan ?? null } })
  return NextResponse.json({ ok: true }, { status: 201 })
}
