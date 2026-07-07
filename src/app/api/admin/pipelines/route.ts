import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/pipelines — content pipeline health at a glance. Triggers
// stay on their existing endpoints (ingest/summarize/brief/reports/alerts),
// all of which accept an ADMIN session.
export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const [latestNews, pendingNews, heldNews, latestBrief, latestReport, lastAlertRun, aiToday] =
    await Promise.all([
      prisma.newsItem.findFirst({
        orderBy: { ingestedAt: 'desc' },
        select: { ingestedAt: true, title: true },
      }),
      prisma.newsItem.count({ where: { aiStatus: 'PENDING' } }),
      prisma.newsItem.count({ where: { aiStatus: 'HELD' } }),
      prisma.marketBrief.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        select: { briefDate: true, tier: true, createdAt: true },
      }),
      prisma.report.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        select: { slug: true, periodKey: true, createdAt: true },
      }),
      prisma.alertDelivery.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, status: true },
      }),
      prisma.aiUsage.findFirst({
        where: { day: new Date().toISOString().slice(0, 10) },
        select: { calls: true },
      }),
    ])

  return NextResponse.json({
    news: { latestAt: latestNews?.ingestedAt ?? null, pending: pendingNews, held: heldNews },
    brief: latestBrief,
    report: latestReport,
    alerts: { lastDeliveryAt: lastAlertRun?.createdAt ?? null },
    ai: { callsToday: aiToday?.calls ?? 0 },
  })
}
