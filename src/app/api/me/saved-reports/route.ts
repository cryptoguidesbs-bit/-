import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/me/saved-reports — bookmarked reports.
export async function GET() {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const saved = await prisma.savedReport.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      report: { select: { id: true, title: true, slug: true, locale: true, publishedAt: true } },
    },
  })

  return NextResponse.json({
    items: saved.map((s) => ({ reportId: s.reportId, savedAt: s.createdAt, ...s.report })),
  })
}

const saveSchema = z.object({ reportId: z.string().min(1) })

// POST /api/me/saved-reports — bookmark a report (idempotent).
export async function POST(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = saveSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const exists = await prisma.report.findUnique({ where: { id: parsed.data.reportId } })
  if (!exists) return NextResponse.json({ error: 'report not found' }, { status: 404 })

  await prisma.savedReport.upsert({
    where: { userId_reportId: { userId: user.id, reportId: parsed.data.reportId } },
    update: {},
    create: { userId: user.id, reportId: parsed.data.reportId },
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}
