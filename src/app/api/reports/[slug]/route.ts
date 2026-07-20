import { NextRequest, NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Full report content by slug (Pro+). Only PUBLISHED reports are
// ever served — drafts/held stay internal.
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const gate = await checkFeature('reports.premium')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }

  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ko'
  const report = await prisma.report.findUnique({
    where: { slug_locale: { slug: params.slug, locale } },
  })
  if (!report || report.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: report.id,
    slug: report.slug,
    locale: report.locale,
    title: report.title,
    summary: report.summary,
    content: report.content,
    cadence: report.cadence,
    category: report.category,
    periodKey: report.periodKey,
    aiModel: report.aiModel,
    publishedAt: report.publishedAt,
  })
}
