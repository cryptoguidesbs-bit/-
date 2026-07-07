import { NextRequest, NextResponse } from 'next/server'

import { logSecurityEvent } from '@/lib/security/audit'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/me/export — GDPR data portability. Returns a machine-readable
// JSON bundle of everything we hold about the requester. Rate-limited and
// audited. Secrets are never included (API key hashes, webhook signing
// secrets are omitted; only prefixes/URLs are exported).
export async function GET(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limited = enforceRateLimit({ name: 'data-export', limit: 5, identifier: user.id, request })
  if (limited) return limited

  const [
    subscription,
    portfolios,
    watchlists,
    savedArticles,
    savedReports,
    notifications,
    consentLogs,
    referralCode,
    referralsMade,
    referralReceived,
    referralRewards,
    apiKeys,
    webhooks,
    alertRules,
  ] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.portfolio.findMany({ where: { userId: user.id }, include: { items: true } }),
    prisma.watchlist.findMany({ where: { userId: user.id }, include: { items: true } }),
    prisma.savedArticle.findMany({ where: { userId: user.id } }),
    prisma.savedReport.findMany({ where: { userId: user.id } }),
    prisma.notification.findMany({ where: { userId: user.id } }),
    prisma.consentLog.findMany({ where: { userId: user.id } }),
    prisma.referralCode.findUnique({ where: { userId: user.id } }),
    prisma.referral.findMany({ where: { referrerId: user.id }, select: { code: true, status: true, createdAt: true } }),
    prisma.referral.findUnique({ where: { referredUserId: user.id }, select: { code: true, status: true, createdAt: true } }),
    prisma.referralReward.findMany({ where: { userId: user.id } }),
    prisma.apiKey.findMany({
      where: { userId: user.id },
      select: { name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    }),
    prisma.apiWebhook.findMany({
      where: { userId: user.id },
      select: { url: true, events: true, active: true, createdAt: true },
    }),
    prisma.alertRule.findMany({ where: { userId: user.id } }),
  ])

  await logSecurityEvent({
    action: 'data.export',
    userId: user.id,
    actorEmail: user.email,
    request,
  })

  const bundle = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      country: user.country,
      role: user.role,
      createdAt: user.createdAt,
    },
    subscription,
    portfolios,
    watchlists,
    savedArticles,
    savedReports,
    notifications,
    consentLogs,
    referral: { code: referralCode, made: referralsMade, received: referralReceived, rewards: referralRewards },
    apiKeys,
    webhooks,
    alertRules,
  }

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="cryptoguide-data-${user.id}.json"`,
      'cache-control': 'no-store',
    },
  })
}
