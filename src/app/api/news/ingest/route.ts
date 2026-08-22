import { NextRequest, NextResponse } from 'next/server'

import { ingestNews, summarizePending } from '@/lib/news/pipeline'
import { canTriggerPipeline } from '@/lib/news/trigger-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Up to this many freshly ingested items are summarized in the same request,
// so new headlines don't sit unsummarized until the next summarize cron.
const INLINE_SUMMARIZE_LIMIT = 20

// Ingest step of the news pipeline (cron secret or admin only). After
// ingesting, immediately summarizes what's pending (bounded) — the separate
// /api/news/summarize cron remains as the backstop for anything left over.
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as { summarize?: boolean }
  const report = await ingestNews()

  // Opt out with {summarize:false} (tests that exercise the two steps apart).
  const summarize =
    body.summarize === false ? null : await summarizePending(INLINE_SUMMARIZE_LIMIT).catch(() => null)

  return NextResponse.json({ ...report, summarize })
}
