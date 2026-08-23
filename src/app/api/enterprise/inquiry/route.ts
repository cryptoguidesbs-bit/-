import { NextRequest, NextResponse } from 'next/server'
import { recordEvent } from '@/lib/events'
import { z } from 'zod'

import { routing } from '@/i18n/routing'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Enterprise is contract-priced and has no Stripe price, so the pricing page
// routes it to this lead form instead of checkout. Public (no account needed);
// abuse is bounded by an IP rate limit.
const inquirySchema = z.object({
  email: z.string().trim().email().max(200),
  organization: z.string().trim().min(1).max(200),
  teamSize: z.string().trim().min(1).max(100),
  useCase: z.string().trim().min(1).max(2000),
  locale: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit({ name: 'enterprise-inquiry', limit: 5, request })
  if (limited) return limited

  const parsed = inquirySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid inquiry' }, { status: 400 })
  }

  const { email, organization, teamSize, useCase } = parsed.data
  const locale = routing.locales.includes(parsed.data.locale as (typeof routing.locales)[number])
    ? (parsed.data.locale as string)
    : routing.defaultLocale

  // An unhandled inquiry from the same email suppresses repeat admin
  // notifications (the lead is still stored) — bounds notification fan-out.
  const alreadyOpen = await prisma.enterpriseInquiry.findFirst({
    where: { email, handledAt: null },
    select: { id: true },
  })

  const inquiry = await prisma.enterpriseInquiry.create({
    data: { email, organization, teamSize, useCase, locale },
  })
  await recordEvent({ name: 'enterprise_inquiry', locale })

  // Notify operators in-app, mirroring the admin announcement pattern.
  // Never block the submission on notification failures.
  if (alreadyOpen) return NextResponse.json({ ok: true, id: inquiry.id }, { status: 201 })

  await prisma.user
    .findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    .then((admins) =>
      admins.length
        ? prisma.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              type: 'SYSTEM' as const,
              title: `[Enterprise 문의] ${organization}`,
              body: `${email} · 팀 규모 ${teamSize}
${useCase}`.slice(0, 1000),
              href: '/admin',
            })),
          })
        : null,
    )
    .catch(() => {})

  return NextResponse.json({ ok: true, id: inquiry.id }, { status: 201 })
}
