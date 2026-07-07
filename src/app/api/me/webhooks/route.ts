import crypto from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkFeature } from '@/lib/entitlements'
import { WEBHOOK_EVENTS } from '@/lib/api/webhooks'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_WEBHOOKS = 5

function gateResponse(gate: Awaited<ReturnType<typeof checkFeature>>) {
  return NextResponse.json(
    { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
    { status: gate.reason === 'auth' ? 401 : 403 },
  )
}

// GET /api/me/webhooks — my webhook endpoints (secret shown as hint only).
export async function GET() {
  const gate = await checkFeature('api.center')
  if (!gate.allowed) return gateResponse(gate)
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const webhooks = await prisma.apiWebhook.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    webhooks: webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
      secretHint: `${w.secret.slice(0, 6)}…`,
      lastDeliveryAt: w.lastDeliveryAt,
      lastStatus: w.lastStatus,
    })),
  })
}

const createSchema = z.object({
  url: z
    .string()
    .url()
    .max(2000)
    .refine(
      (u) =>
        u.startsWith('https://') ||
        (process.env.NODE_ENV !== 'production' && u.startsWith('http://')),
      { message: 'https required' },
    ),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
})

// POST /api/me/webhooks — register an endpoint. The signing secret is
// returned once at creation.
export async function POST(request: NextRequest) {
  const gate = await checkFeature('api.center')
  if (!gate.allowed) return gateResponse(gate)
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid webhook' }, { status: 400 })

  const count = await prisma.apiWebhook.count({ where: { userId: user.id } })
  if (count >= MAX_WEBHOOKS) {
    return NextResponse.json({ error: `webhook limit reached (${MAX_WEBHOOKS})` }, { status: 409 })
  }

  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`
  const webhook = await prisma.apiWebhook.create({
    data: { userId: user.id, url: parsed.data.url, events: parsed.data.events, secret },
  })
  return NextResponse.json(
    {
      ok: true,
      secret, // shown once
      webhook: { id: webhook.id, url: webhook.url, events: webhook.events },
    },
    { status: 201 },
  )
}
