import { NextResponse } from 'next/server'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/me/alerts/deliveries — recent delivery log for the requester.
export async function GET() {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const deliveries = await prisma.alertDelivery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      ruleId: true,
      type: true,
      channel: true,
      title: true,
      body: true,
      status: true,
      transport: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ deliveries })
}
