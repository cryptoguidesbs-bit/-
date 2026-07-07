import 'server-only'

import type { Prisma } from '@prisma/client'

import { ADMIN_OPS } from '@/config/admin'
import { createNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Automated ops monitor (stage 19) — the "no operator required" loop.
// Runs from cron (or the admin dashboard):
//   1. member/subscription hygiene: PAST_DUE subscriptions past the grace
//      period auto-expire (entitlements drop without manual action)
//   2. anomaly detection: payment-failure spikes, stale content pipelines
//   3. every NEW anomaly notifies all ADMIN users in-app; an unresolved
//      event of the same kind suppresses duplicates
// ---------------------------------------------------------------------------

export type MonitorSummary = {
  expiredSubscriptions: number
  eventsRaised: string[]
  eventsSuppressed: string[]
  adminsNotified: number
}

type Anomaly = { kind: string; severity: 'warning' | 'critical'; message: string; data?: Record<string, unknown> }

async function detectAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = []

  // Payment failures.
  const failing = await prisma.subscription.count({
    where: { status: { in: ['PAST_DUE', 'INCOMPLETE'] } },
  })
  if (failing >= ADMIN_OPS.paymentFailureThreshold) {
    anomalies.push({
      kind: 'anomaly.payment_failures',
      severity: 'critical',
      message: `결제 실패 상태 구독이 ${failing}건입니다 (임계값 ${ADMIN_OPS.paymentFailureThreshold}건).`,
      data: { failing, threshold: ADMIN_OPS.paymentFailureThreshold },
    })
  }

  // News pipeline staleness.
  const latestNews = await prisma.newsItem.findFirst({
    orderBy: { ingestedAt: 'desc' },
    select: { ingestedAt: true },
  })
  const newsAgeH = latestNews
    ? (Date.now() - latestNews.ingestedAt.getTime()) / 3_600_000
    : Infinity
  if (newsAgeH > ADMIN_OPS.newsStaleHours) {
    anomalies.push({
      kind: 'anomaly.news_stale',
      severity: 'warning',
      message: latestNews
        ? `뉴스 수집이 ${Math.round(newsAgeH)}시간째 멈춰 있습니다.`
        : '수집된 뉴스가 없습니다.',
      data: { hours: Math.round(newsAgeH) },
    })
  }

  // Brief pipeline staleness.
  const latestBrief = await prisma.marketBrief.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  const briefAgeH = latestBrief
    ? (Date.now() - latestBrief.createdAt.getTime()) / 3_600_000
    : Infinity
  if (briefAgeH > ADMIN_OPS.briefStaleHours) {
    anomalies.push({
      kind: 'anomaly.brief_stale',
      severity: 'warning',
      message: latestBrief
        ? `AI 브리핑 발행이 ${Math.round(briefAgeH)}시간째 없습니다.`
        : '발행된 브리핑이 없습니다.',
      data: { hours: Math.round(briefAgeH) },
    })
  }

  return anomalies
}

export async function runOpsMonitor(): Promise<MonitorSummary> {
  const summary: MonitorSummary = {
    expiredSubscriptions: 0,
    eventsRaised: [],
    eventsSuppressed: [],
    adminsNotified: 0,
  }

  // 1. Subscription hygiene — auto-expire PAST_DUE past the grace period.
  const graceCutoff = new Date(Date.now() - ADMIN_OPS.expireGraceDays * 86_400_000)
  const expired = await prisma.subscription.updateMany({
    where: { status: 'PAST_DUE', currentPeriodEnd: { lt: graceCutoff } },
    data: { status: 'EXPIRED' },
  })
  summary.expiredSubscriptions = expired.count

  // 2. Anomaly detection with same-kind dedup.
  const anomalies = await detectAnomalies()
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })

  for (const anomaly of anomalies) {
    const open = await prisma.opsEvent.findFirst({
      where: { kind: anomaly.kind, resolvedAt: null },
    })
    if (open) {
      summary.eventsSuppressed.push(anomaly.kind)
      continue
    }

    await prisma.opsEvent.create({
      data: {
        kind: anomaly.kind,
        severity: anomaly.severity,
        message: anomaly.message,
        data: (anomaly.data ?? {}) as Prisma.InputJsonValue,
      },
    })
    summary.eventsRaised.push(anomaly.kind)

    // 3. Notify every admin in-app.
    for (const admin of admins) {
      await createNotification(admin.id, {
        type: 'SYSTEM',
        title: `[운영 경보] ${anomaly.kind}`,
        body: anomaly.message,
        href: '/admin',
      })
      summary.adminsNotified += 1
    }
  }

  return summary
}
