import { NextRequest, NextResponse } from 'next/server'

import { deliverWebhook } from '@/lib/api/webhooks'
import { checkFeature } from '@/lib/entitlements'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// POST /api/me/webhooks/:id/test — send a signed test.ping delivery.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await checkFeature('api.center')
  if (!gate.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: gate.reason === 'auth' ? 401 : 403 })
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Each test is an outbound POST to a user-chosen URL — keep it slow.
  const limited = enforceRateLimit({ name: 'webhook-test', limit: 6, identifier: user.id, request })
  if (limited) return limited

  const webhook = await prisma.apiWebhook.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!webhook) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const result = await deliverWebhook(webhook, 'test.ping', {
    message: 'CryptoGuide webhook test',
  })
  return NextResponse.json({ ok: result.delivered, result })
}
