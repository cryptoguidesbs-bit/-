import { NextRequest, NextResponse } from 'next/server'

import { generateReports } from '@/lib/reports/generator'
import { canTriggerPipeline } from '@/lib/news/trigger-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

const CADENCES = new Set(['WEEKLY', 'MONTHLY', 'QUARTERLY'])

// Generates the period's research reports (ETF/MACRO/ONCHAIN × ko/en).
// Cron secret or admin only.
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    cadence?: string
    date?: string
    mockScenario?: string
  }
  const cadence = (body.cadence ?? 'WEEKLY').toUpperCase()
  if (!CADENCES.has(cadence)) {
    return NextResponse.json({ error: 'invalid cadence' }, { status: 400 })
  }
  const date =
    body.date && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date) : undefined
  const mockScenario =
    process.env.NODE_ENV !== 'production' && typeof body.mockScenario === 'string'
      ? body.mockScenario
      : undefined

  const report = await generateReports({
    cadence: cadence as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY',
    date,
    mockScenario,
  })
  const anyDeferred = report.items.some((i) => i.status === 'deferred')
  return NextResponse.json(report, { status: anyDeferred ? 429 : 200 })
}
