import { NextResponse } from 'next/server'

import { deliverWebhook } from '@/lib/api/webhooks'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/me/webhooks/:id/test — send a signed test.ping delivery.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const webhook = await prisma.apiWebhook.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!webhook) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const result = await deliverWebhook(webhook, 'test.ping', {
    message: 'CryptoGuide webhook test',
  })
  return NextResponse.json({ ok: result.delivered, result })
}
