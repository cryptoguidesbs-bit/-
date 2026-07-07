import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  role: z.enum(['USER', 'ADMIN']).optional(),
  // Manual plan override (support/compensation cases) — upserts an ACTIVE
  // subscription; 'FREE' removes it.
  plan: z.enum(['FREE', 'STANDARD', 'PROFESSIONAL', 'INSTITUTIONAL', 'LEGENDARY']).optional(),
})

// PATCH /api/admin/members/:id — role / manual plan management.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid patch' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id: params.id } })
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Guard: an admin cannot demote themselves (avoids locking everyone out).
  if (parsed.data.role && target.id === admin.user.id && parsed.data.role !== 'ADMIN') {
    return NextResponse.json({ error: 'cannot demote yourself' }, { status: 400 })
  }

  if (parsed.data.role) {
    await prisma.user.update({ where: { id: target.id }, data: { role: parsed.data.role } })
  }

  if (parsed.data.plan) {
    if (parsed.data.plan === 'FREE') {
      await prisma.subscription.deleteMany({ where: { userId: target.id } })
    } else {
      await prisma.subscription.upsert({
        where: { userId: target.id },
        update: { plan: parsed.data.plan, status: 'ACTIVE' },
        create: { userId: target.id, plan: parsed.data.plan, status: 'ACTIVE' },
      })
    }
  }

  const updated = await prisma.user.findUnique({
    where: { id: target.id },
    select: {
      id: true,
      email: true,
      role: true,
      subscription: { select: { plan: true, status: true } },
    },
  })
  return NextResponse.json({ ok: true, member: updated })
}
