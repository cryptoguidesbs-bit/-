import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'

import { logSecurityEvent } from '@/lib/security/audit'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Clerk webhook (svix-signed). Verifies the signature, then keeps our User
// table in sync with the identity provider:
//   user.deleted → cascade-delete our row (GDPR erasure from the IdP side)
//   user.updated → sync email / name / image
// The signing secret (CLERK_WEBHOOK_SECRET) is required; without it every
// delivery is rejected rather than trusted.
export async function POST(request: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/clerk] CLERK_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'not configured' }, { status: 500 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing signature headers' }, { status: 400 })
  }

  const body = await request.text()

  let event: { type: string; data: Record<string, unknown> }
  try {
    event = new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const clerkId = String(event.data.id ?? '')

  if (event.type === 'user.deleted' && clerkId) {
    const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true, email: true } })
    if (user) {
      // Cascade deletes portfolios, watchlists, referrals, api keys, etc.
      await prisma.user.delete({ where: { id: user.id } })
      await logSecurityEvent({
        action: 'account.deleted.webhook',
        actorEmail: user.email,
        meta: { clerkId },
      })
    }
    return NextResponse.json({ received: true })
  }

  if (event.type === 'user.updated' && clerkId) {
    const emails = event.data.email_addresses as { email_address?: string }[] | undefined
    const email = emails?.[0]?.email_address
    const name =
      [event.data.first_name, event.data.last_name].filter(Boolean).join(' ') || null
    await prisma.user
      .update({
        where: { clerkId },
        data: {
          ...(email ? { email } : {}),
          name,
          image: (event.data.image_url as string) ?? undefined,
        },
      })
      .catch(() => {})
    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
