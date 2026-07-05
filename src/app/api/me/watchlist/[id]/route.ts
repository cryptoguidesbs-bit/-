import { NextResponse } from 'next/server'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// DELETE /api/me/watchlist/:id — remove an item (ownership enforced).
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const deleted = await prisma.watchlistItem.deleteMany({
    where: { id: params.id, watchlist: { userId: user.id } },
  })
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
