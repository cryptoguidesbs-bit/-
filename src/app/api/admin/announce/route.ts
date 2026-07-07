import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const announceSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(1000).optional(),
  href: z.string().max(300).optional(),
})

// POST /api/admin/announce — broadcast an in-app announcement to all users.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const parsed = announceSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid announcement' }, { status: 400 })

  const users = await prisma.user.findMany({ select: { id: true } })
  const result = await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: 'SYSTEM' as const,
      title: parsed.data.title.slice(0, 200),
      body: parsed.data.body?.slice(0, 1000),
      href: parsed.data.href,
    })),
  })
  return NextResponse.json({ ok: true, sent: result.count })
}
