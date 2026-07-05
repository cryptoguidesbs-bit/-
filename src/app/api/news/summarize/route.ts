import { NextRequest, NextResponse } from 'next/server'

import { summarizePending } from '@/lib/news/pipeline'
import { canTriggerPipeline } from '@/lib/news/trigger-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Summarize step of the news pipeline (cron secret or admin only).
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as { limit?: number }
  const limit = Math.min(50, Math.max(1, Number(body.limit) || 15))
  const report = await summarizePending(limit)
  return NextResponse.json(report)
}
