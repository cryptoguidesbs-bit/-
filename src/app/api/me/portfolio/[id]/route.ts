import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkFeature } from '@/lib/entitlements'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  quantity: z.number().positive().max(1e12).optional(),
  avgCost: z.number().min(0).max(1e12).optional(),
  note: z.string().max(200).nullable().optional(),
})

// PATCH /api/me/portfolio/:id — update a holding.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await checkFeature('portfolio.tools')
  if (!gate.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: gate.reason === 'auth' ? 401 : 403 })
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid update' }, { status: 400 })
  }

  const updated = await prisma.portfolioItem.updateMany({
    where: { id: params.id, portfolio: { userId: user.id } },
    data: parsed.data,
  })
  if (updated.count === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/me/portfolio/:id — remove a holding.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const gate = await checkFeature('portfolio.tools')
  if (!gate.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: gate.reason === 'auth' ? 401 : 403 })
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const deleted = await prisma.portfolioItem.deleteMany({
    where: { id: params.id, portfolio: { userId: user.id } },
  })
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
