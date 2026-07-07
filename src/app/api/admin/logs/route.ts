import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/logs?type=audit|consent&q= — compliance log viewers.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const params = request.nextUrl.searchParams
  const type = params.get('type') ?? 'audit'
  const q = params.get('q')?.trim()
  const take = Math.min(Number(params.get('take')) || 50, 200)

  if (type === 'consent') {
    const rows = await prisma.consentLog.findMany({
      where: q ? { user: { email: { contains: q, mode: 'insensitive' } } } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        type: true,
        version: true,
        granted: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    })
    return NextResponse.json({ type, rows })
  }

  if (type === 'audit') {
    const rows = await prisma.contentAuditLog.findMany({
      where: q
        ? {
            OR: [
              { reason: { contains: q, mode: 'insensitive' } },
              { contentId: q },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        action: true,
        contentType: true,
        contentId: true,
        reason: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ type, rows })
  }

  return NextResponse.json({ error: 'invalid type' }, { status: 400 })
}
