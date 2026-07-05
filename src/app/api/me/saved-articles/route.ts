import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/me/saved-articles — bookmarked news with article details.
export async function GET() {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const saved = await prisma.savedArticle.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      newsItem: {
        select: { id: true, title: true, url: true, source: true, publishedAt: true },
      },
    },
  })

  return NextResponse.json({
    items: saved.map((s) => ({
      newsItemId: s.newsItemId,
      savedAt: s.createdAt,
      ...s.newsItem,
    })),
  })
}

const saveSchema = z.object({ newsItemId: z.string().min(1) })

// POST /api/me/saved-articles — bookmark an article (idempotent).
export async function POST(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = saveSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const exists = await prisma.newsItem.findUnique({ where: { id: parsed.data.newsItemId } })
  if (!exists) return NextResponse.json({ error: 'article not found' }, { status: 404 })

  await prisma.savedArticle.upsert({
    where: { userId_newsItemId: { userId: user.id, newsItemId: parsed.data.newsItemId } },
    update: {},
    create: { userId: user.id, newsItemId: parsed.data.newsItemId },
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}
