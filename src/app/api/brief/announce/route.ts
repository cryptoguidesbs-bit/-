import { NextRequest, NextResponse } from 'next/server'

import type { BriefSections } from '@/lib/brief/guidelines'
import { canTriggerPipeline } from '@/lib/news/trigger-auth'
import { prisma } from '@/lib/prisma'
import { announceBrief } from '@/lib/social/brief-post'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Manually (re)announce a published STANDARD brief on X / Telegram.
// Cron secret or admin only. Body: { date?: "YYYY-MM-DD", dryRun?: boolean }.
// Default = latest published brief; dryRun returns the composed texts
// without calling any network — use it to preview a post.
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { date?: string; dryRun?: boolean }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? '') ? body.date : undefined

  const brief = await prisma.marketBrief.findFirst({
    where: { tier: 'STANDARD', status: 'PUBLISHED', ...(date ? { briefDate: date } : {}) },
    orderBy: { briefDate: 'desc' },
  })
  if (!brief) return NextResponse.json({ error: 'no published brief' }, { status: 404 })

  const report = await announceBrief({
    briefDate: brief.briefDate,
    sections: brief.sections as unknown as BriefSections,
    dryRun: body.dryRun === true,
  })
  const anyFailed = report.outcomes.some((o) => o.status === 'failed')
  return NextResponse.json(report, { status: anyFailed ? 502 : 200 })
}
