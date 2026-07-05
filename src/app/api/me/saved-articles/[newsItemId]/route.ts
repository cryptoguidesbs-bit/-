import { NextResponse } from 'next/server'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// DELETE /api/me/saved-articles/:newsItemId — remove a bookmark.
export async function DELETE(
  _request: Request,
  { params }: { params: { newsItemId: string } },
) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const deleted = await prisma.savedArticle.deleteMany({
    where: { userId: user.id, newsItemId: params.newsItemId },
  })
  if (deleted.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
