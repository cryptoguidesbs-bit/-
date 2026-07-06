import { NextRequest, NextResponse } from 'next/server'

import { canTriggerPipeline } from '@/lib/news/trigger-auth'
import { testControls } from '@/lib/market/request-helpers'
import { runAlerts } from '@/lib/alerts/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/alerts/run — evaluate all active alert rules and deliver
// notifications. Internal: cron secret header or ADMIN session.
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { blocked, cacheSuffix } = testControls(request)
  // Non-production test hook: inject a directive phrase into composed
  // messages to prove the guideline filter blocks delivery.
  const testDirectiveSuffix =
    process.env.NODE_ENV !== 'production'
      ? request.headers.get('x-test-directive-suffix') ?? undefined
      : undefined

  const summary = await runAlerts({ blocked, cacheSuffix, testDirectiveSuffix })
  return NextResponse.json({ ok: true, summary })
}
