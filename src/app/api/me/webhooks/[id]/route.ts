import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({ active: z.boolean() })

// PATCH /api/me/webhooks/:id — enable/disable.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid patch' }, { status: 400 })

  const updated = await prisma.apiWebhook.updateMany({
    where: { id: params.id, userId: user.id },
    data: { active: parsed.data.active },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/me/webhooks/:id — remove.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const deleted = await prisma.apiWebhook.deleteMany({
    where: { id: params.id, userId: user.id },
  })
  if (deleted.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
