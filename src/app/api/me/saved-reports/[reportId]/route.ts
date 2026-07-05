import { NextResponse } from 'next/server'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// DELETE /api/me/saved-reports/:reportId — remove a bookmark.
export async function DELETE(_request: Request, { params }: { params: { reportId: string } }) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const deleted = await prisma.savedReport.deleteMany({
    where: { userId: user.id, reportId: params.reportId },
  })
  if (deleted.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
