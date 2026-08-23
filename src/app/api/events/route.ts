import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { isProductEvent, recordEvent } from '@/lib/events'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/prisma'
import { routing } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  name: z.string().min(1).max(40),
  path: z.string().max(200).optional(),
  locale: z.string().max(5).optional(),
})

// POST /api/events — client-side page-view events (allowlisted names only).
// Public (anonymous views count too), same-origin enforced by the middleware
// CSRF check, per-IP rate limited. Returns 204 always on accepted input.
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit({ name: 'events', limit: 60, request })
  if (limited) return limited

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success || !isProductEvent(parsed.data.name)) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 })
  }
  // Client-reported events are page views plus the paid-CTA click; every
  // other action is recorded server-side by the route that performs it.
  if (!parsed.data.name.endsWith('_view') && parsed.data.name !== 'paid_cta_click') {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 })
  }

  const { userId: clerkId } = await auth()
  const user = clerkId
    ? await prisma.user.findUnique({ where: { clerkId }, select: { id: true } }).catch(() => null)
    : null
  const locale = routing.locales.includes(parsed.data.locale as (typeof routing.locales)[number])
    ? parsed.data.locale
    : null

  await recordEvent({ name: parsed.data.name, userId: user?.id, locale, path: parsed.data.path })
  return new NextResponse(null, { status: 204 })
}
