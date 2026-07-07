import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/analytics — operational overview numbers.
export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const since7 = new Date(Date.now() - 7 * 86_400_000)
  const since30 = new Date(Date.now() - 30 * 86_400_000)
  const day30 = since30.toISOString().slice(0, 10)

  const [
    totalUsers,
    signups7d,
    signups30d,
    planGroups,
    referralQualified,
    apiCalls30d,
    alertsSent30d,
    consents30d,
    openOpsEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.subscription.groupBy({
      by: ['plan', 'status'],
      _count: { plan: true },
    }),
    prisma.referral.count({ where: { status: 'QUALIFIED' } }),
    prisma.apiUsage.aggregate({ _sum: { count: true }, where: { day: { gte: day30 } } }),
    prisma.alertDelivery.count({ where: { status: 'SENT', createdAt: { gte: since30 } } }),
    prisma.consentLog.count({ where: { createdAt: { gte: since30 } } }),
    prisma.opsEvent.count({ where: { resolvedAt: null } }),
  ])

  return NextResponse.json({
    users: { total: totalUsers, signups7d, signups30d },
    subscriptions: planGroups.map((g) => ({
      plan: g.plan,
      status: g.status,
      count: g._count.plan,
    })),
    referrals: { qualified: referralQualified },
    api: { calls30d: apiCalls30d._sum.count ?? 0 },
    alerts: { sent30d: alertsSent30d },
    consents30d,
    openOpsEvents,
  })
}
