import { NextRequest, NextResponse } from 'next/server'

import { generateDailyBriefs } from '@/lib/brief/generator'
import { canTriggerPipeline } from '@/lib/news/trigger-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Generates today's briefs (STANDARD + DETAILED). Cron secret or admin only.
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    date?: string
    mockScenario?: string
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? '') ? body.date : undefined
  // Test hook is dev-only.
  const mockScenario =
    process.env.NODE_ENV !== 'production' && typeof body.mockScenario === 'string'
      ? body.mockScenario
      : undefined

  const report = await generateDailyBriefs({ date, mockScenario })
  const anyDeferred = report.tiers.some((t) => t.status === 'deferred')
  return NextResponse.json(report, { status: anyDeferred ? 429 : 200 })
}
