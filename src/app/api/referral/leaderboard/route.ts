import { NextResponse } from 'next/server'

import { REFERRAL } from '@/config/referral'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Privacy: never expose the full name/email of a referrer on the public
// leaderboard — first two characters only.
function maskName(name: string | null, email: string): string {
  const base = (name?.trim() || email.split('@')[0] || 'user').slice(0, 2)
  return `${base}***`
}

// GET /api/referral/leaderboard — top referrers by QUALIFIED referrals.
export async function GET() {
  const grouped = await prisma.referral.groupBy({
    by: ['referrerId'],
    where: { status: 'QUALIFIED' },
    _count: { referrerId: true },
    orderBy: { _count: { referrerId: 'desc' } },
    take: REFERRAL.leaderboardSize,
  })

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.referrerId) } },
    select: { id: true, name: true, email: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))

  return NextResponse.json({
    leaderboard: grouped.map((g, i) => {
      const u = byId.get(g.referrerId)
      return {
        rank: i + 1,
        name: u ? maskName(u.name, u.email) : 'user***',
        qualified: g._count.referrerId,
      }
    }),
  })
}
