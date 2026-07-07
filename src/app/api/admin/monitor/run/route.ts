import { NextRequest, NextResponse } from 'next/server'

import { canTriggerPipeline } from '@/lib/news/trigger-auth'
import { runOpsMonitor } from '@/lib/admin/monitor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/admin/monitor/run — the automated ops cycle (cron or ADMIN):
// subscription hygiene → anomaly detection → admin notifications.
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const summary = await runOpsMonitor()
  return NextResponse.json({ ok: true, summary })
}
