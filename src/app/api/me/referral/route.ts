import { NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { getOrCreateReferralCode } from '@/lib/referral/code'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

// GET /api/me/referral — my referral link, stats and reward ledger.
// The program is open to every signed-in member; whether monetary rewards
// apply in the requester's region is reported via `rewardsAllowed`.
export async function GET() {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rewardsGate = await checkFeature('referral.rewards')

  const code = await getOrCreateReferralCode(user.id)
  const [pending, qualified, rewards] = await Promise.all([
    prisma.referral.count({ where: { referrerId: user.id, status: 'PENDING' } }),
    prisma.referral.count({ where: { referrerId: user.id, status: 'QUALIFIED' } }),
    prisma.referralReward.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, amountUsd: true, status: true, note: true, createdAt: true },
    }),
  ])

  return NextResponse.json({
    code: code.code,
    link: `${siteUrl}/r/${code.code}`,
    clicks: code.clicks,
    stats: { pending, qualified },
    rewardsAllowed: rewardsGate.allowed,
    rewards: rewards.map((r) => ({ ...r, amountUsd: Number(r.amountUsd) })),
  })
}
