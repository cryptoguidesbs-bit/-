import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/ops-events?open=1 — monitor event stream.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const openOnly = request.nextUrl.searchParams.get('open') === '1'
  const events = await prisma.opsEvent.findMany({
    where: openOnly ? { resolvedAt: null } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ events })
}
