import { NextRequest, NextResponse } from 'next/server'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/me/notifications[?unread=1] — newest first.
export async function GET(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const unreadOnly = request.nextUrl.searchParams.get('unread') === '1'
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ])

  return NextResponse.json({ items, unreadCount })
}
