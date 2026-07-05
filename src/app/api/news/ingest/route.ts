import { NextRequest, NextResponse } from 'next/server'

import { ingestNews } from '@/lib/news/pipeline'
import { canTriggerPipeline } from '@/lib/news/trigger-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Ingest step of the news pipeline (cron secret or admin only).
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const report = await ingestNews()
  return NextResponse.json(report)
}
