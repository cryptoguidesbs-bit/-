import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkFeature } from '@/lib/entitlements'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'
import { channelConfigSchemaByChannel, type ConfigurableChannel } from '@/lib/alerts/types'

export const dynamic = 'force-dynamic'

// GET /api/me/alerts/channels — the requester's channel configs.
export async function GET() {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const channels = await prisma.alertChannelConfig.findMany({
    where: { userId: user.id },
    select: { channel: true, config: true, updatedAt: true },
  })
  return NextResponse.json({ channels })
}

const putSchema = z.object({
  channel: z.enum(['TELEGRAM', 'EMAIL', 'PUSH']),
  config: z.unknown(),
})

// PUT /api/me/alerts/channels — upsert a channel config (Trader+).
// INAPP needs no configuration and is rejected here.
export async function PUT(request: NextRequest) {
  const gate = await checkFeature('alerts.realtime')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = putSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid channel' }, { status: 400 })

  const channel = parsed.data.channel as ConfigurableChannel
  const configParsed = channelConfigSchemaByChannel[channel].safeParse(parsed.data.config)
  if (!configParsed.success) {
    return NextResponse.json(
      { error: 'invalid config', issues: configParsed.error.issues.map((i) => i.message) },
      { status: 400 },
    )
  }

  const saved = await prisma.alertChannelConfig.upsert({
    where: { userId_channel: { userId: user.id, channel } },
    update: { config: configParsed.data },
    create: { userId: user.id, channel, config: configParsed.data },
  })
  return NextResponse.json({ ok: true, channel: saved.channel })
}

const deleteSchema = z.object({ channel: z.enum(['TELEGRAM', 'EMAIL', 'PUSH']) })

// DELETE /api/me/alerts/channels — remove a channel config.
export async function DELETE(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid channel' }, { status: 400 })

  const deleted = await prisma.alertChannelConfig.deleteMany({
    where: { userId: user.id, channel: parsed.data.channel },
  })
  if (deleted.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
