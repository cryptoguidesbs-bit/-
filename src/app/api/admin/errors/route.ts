import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/errors — recent Sentry issues. Requires SENTRY_AUTH_TOKEN +
// SENTRY_ORG + SENTRY_PROJECT; unconfigured environments report that state
// instead of failing (dev fallback).
export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const token = process.env.SENTRY_AUTH_TOKEN
  const org = process.env.SENTRY_ORG
  const project = process.env.SENTRY_PROJECT
  if (!token || !org || !project) {
    return NextResponse.json({ source: 'unconfigured', issues: [] })
  }

  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?statsPeriod=24h&query=is:unresolved&limit=20`,
      { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) },
    )
    if (!res.ok) throw new Error(`sentry ${res.status}`)
    const issues = (await res.json()) as {
      id: string
      title: string
      level: string
      count: string
      lastSeen: string
      permalink: string
    }[]
    return NextResponse.json({
      source: 'sentry',
      issues: issues.map((i) => ({
        id: i.id,
        title: i.title,
        level: i.level,
        count: i.count,
        lastSeen: i.lastSeen,
        permalink: i.permalink,
      })),
    })
  } catch (err) {
    return NextResponse.json({ source: 'error', issues: [], error: String(err) })
  }
}
