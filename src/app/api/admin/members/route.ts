import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/members?q= — member search with subscription state.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const q = request.nextUrl.searchParams.get('q')?.trim()
  const members = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      country: true,
      createdAt: true,
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
    },
  })
  return NextResponse.json({ members })
}
