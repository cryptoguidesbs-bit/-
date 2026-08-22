import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'
import { resilientFetch } from '@/lib/market/resilient'
import { cryptoSources, sentimentSources, type AssetQuote } from '@/lib/market/sources'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/board — everything the operator wall-board shows, in one
// payload (polled every 60 s by /admin/board). ADMIN only. Cron "health" is
// derived from the freshest row each job leaves behind, so it reflects what
// actually landed in the database rather than what the scheduler claims.

const KST_OFFSET_MS = 9 * 3_600_000

/** Start of today in Asia/Seoul (no DST), as a UTC Date. */
function kstDayStart(now = new Date()): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  kst.setUTCHours(0, 0, 0, 0)
  return new Date(kst.getTime() - KST_OFFSET_MS)
}

function ageMinutes(date: Date | null | undefined): number | null {
  if (!date) return null
  return Math.round((Date.now() - date.getTime()) / 60_000)
}

type Health = 'ok' | 'warn' | 'down' | 'unknown'
function health(ageMin: number | null, okWithin: number, warnWithin: number): Health {
  if (ageMin === null) return 'unknown'
  if (ageMin <= okWithin) return 'ok'
  if (ageMin <= warnWithin) return 'warn'
  return 'down'
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const now = new Date()
  const todayStart = kstDayStart(now)
  const since24h = new Date(now.getTime() - 86_400_000)
  const since7d = new Date(now.getTime() - 7 * 86_400_000)

  const [
    totalUsers,
    usersToday,
    users7d,
    activeSubs,
    waitlistTotal,
    waitlistToday,
    inquiriesOpen,
    latestNews,
    newsPending,
    newsPublishedToday,
    latestBriefs,
    activeRules,
    deliveries24h,
    lastDelivery,
    lastMapSync,
    mapPlaces,
    openOps,
    latestOps,
    aiToday,
    prices,
    sentiment,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.subscription.groupBy({
      by: ['plan'],
      where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      _count: { plan: true },
    }),
    prisma.waitlistSignup.count(),
    prisma.waitlistSignup.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.enterpriseInquiry.count({ where: { handledAt: null } }),
    prisma.newsItem.findFirst({ orderBy: { ingestedAt: 'desc' }, select: { ingestedAt: true } }),
    prisma.newsItem.count({ where: { aiStatus: 'PENDING' } }),
    prisma.newsItem.count({ where: { aiStatus: 'PUBLISHED', ingestedAt: { gte: todayStart } } }),
    prisma.marketBrief.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { briefDate: true, tier: true, aiModel: true, createdAt: true },
    }),
    prisma.alertRule.count({ where: { active: true } }),
    prisma.alertDelivery.count({ where: { status: 'SENT', createdAt: { gte: since24h } } }),
    prisma.alertDelivery.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.mapPlace.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } }),
    prisma.mapPlace.count(),
    prisma.opsEvent.count({ where: { resolvedAt: null } }),
    prisma.opsEvent.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, kind: true, severity: true, message: true, createdAt: true },
    }),
    prisma.aiUsage.findFirst({
      where: { day: now.toISOString().slice(0, 10) },
      select: { calls: true },
    }),
    resilientFetch('crypto-prices', cryptoSources, { freshMs: 60_000 }),
    resilientFetch('sentiment', sentimentSources, { freshMs: 10 * 60_000 }),
  ])

  const newsAge = ageMinutes(latestNews?.ingestedAt)
  const briefAge = ageMinutes(latestBriefs[0]?.createdAt)
  const mapAge = ageMinutes(lastMapSync?.syncedAt)
  const alertAge = ageMinutes(lastDelivery?.createdAt)

  return NextResponse.json({
    generatedAt: now.toISOString(),
    users: { total: totalUsers, today: usersToday, last7d: users7d },
    plans: Object.fromEntries(activeSubs.map((g) => [g.plan, g._count.plan])),
    waitlist: { total: waitlistTotal, today: waitlistToday },
    inquiries: { open: inquiriesOpen },
    news: {
      latestAt: latestNews?.ingestedAt ?? null,
      ageMin: newsAge,
      pending: newsPending,
      publishedToday: newsPublishedToday,
      health: health(newsAge, 45, 90),
    },
    brief: {
      latest: latestBriefs[0] ?? null,
      tiers: latestBriefs.map((b) => b.tier),
      ageMin: briefAge,
      health: health(briefAge, 26 * 60, 50 * 60),
    },
    alerts: {
      activeRules,
      sent24h: deliveries24h,
      lastDeliveryAt: lastDelivery?.createdAt ?? null,
      ageMin: alertAge,
    },
    map: {
      places: mapPlaces,
      lastSyncAt: lastMapSync?.syncedAt ?? null,
      ageMin: mapAge,
      health: health(mapAge, 26 * 60, 50 * 60),
    },
    market: {
      prices: (prices.data as AssetQuote[] | null) ?? [],
      source: prices.source,
      stale: prices.stale,
      updatedAt: prices.updatedAt,
      fearGreed: sentiment.data as { value: number; classification: string } | null,
    },
    ai: {
      callsToday: aiToday?.calls ?? 0,
      model: latestBriefs[0]?.aiModel ?? null,
      mock: (latestBriefs[0]?.aiModel ?? '').startsWith('mock'),
    },
    ops: { open: openOps, latest: latestOps },
  })
}
