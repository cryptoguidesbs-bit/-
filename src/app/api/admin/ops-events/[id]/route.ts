import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/ops-events/:id — mark resolved (same-kind alerts can
// fire again afterwards).
export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const updated = await prisma.opsEvent.updateMany({
    where: { id: params.id, resolvedAt: null },
    data: { resolvedAt: new Date() },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
