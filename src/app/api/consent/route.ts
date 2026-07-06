import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

import { CONSENT_VERSION } from '@/config/consent'
import { REFERRAL } from '@/config/referral'
import { routing } from '@/i18n/routing'
import { attributeReferral } from '@/lib/referral/attribution'
import { prisma } from '@/lib/prisma'

// Records the "not investment advice · informational/educational purposes"
// consent: appends an immutable ConsentLog row and stamps the version on the
// Clerk user's publicMetadata (which the ConsentGate checks).
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { locale?: string }
  const locale = routing.locales.includes(body.locale as (typeof routing.locales)[number])
    ? (body.locale as string)
    : routing.defaultLocale

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress
  if (!email) {
    return NextResponse.json({ error: 'no email on account' }, { status: 400 })
  }

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username
  // Country from the platform geo header — persisted so region policies can
  // be evaluated outside a request context (e.g. referral reward accrual).
  const country =
    request.headers.get('x-vercel-ip-country')?.toUpperCase() ??
    request.headers.get('cf-ipcountry')?.toUpperCase() ??
    null
  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    update: { email, name, image: clerkUser.imageUrl, ...(country ? { country } : {}) },
    create: {
      clerkId: userId,
      email,
      name,
      image: clerkUser.imageUrl,
      locale,
      country,
    },
  })

  // Append-only: one granted row per consent version.
  const existing = await prisma.consentLog.findFirst({
    where: {
      userId: user.id,
      type: 'INVESTMENT_DISCLAIMER',
      version: CONSENT_VERSION,
      granted: true,
    },
  })

  if (!existing) {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null
    await prisma.consentLog.create({
      data: {
        userId: user.id,
        type: 'INVESTMENT_DISCLAIMER',
        version: CONSENT_VERSION,
        granted: true,
        ipAddress,
        userAgent: request.headers.get('user-agent'),
      },
    })
  }

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      consentVersion: CONSENT_VERSION,
      consentAt: new Date().toISOString(),
    },
  })

  // Referral attribution (stage 17): if the signup carried the referral
  // cookie, record it — with anti-abuse checks. Never fails the consent.
  const refCode = request.cookies.get(REFERRAL.cookieName)?.value
  if (refCode) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null
    await attributeReferral({ referredUserId: user.id, code: refCode, ip }).catch(() => {})
  }

  return NextResponse.json({ ok: true, version: CONSENT_VERSION })
}
