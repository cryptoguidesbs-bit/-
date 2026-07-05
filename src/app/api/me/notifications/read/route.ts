import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const readSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }),
])

// POST /api/me/notifications/read — mark all (or specific ids) as read.
export async function POST(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = readSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const where =
    'all' in parsed.data
      ? { userId: user.id, readAt: null }
      : { userId: user.id, id: { in: parsed.data.ids } }

  const updated = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  })
  return NextResponse.json({ ok: true, updated: updated.count })
}
