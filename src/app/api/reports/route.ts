import { NextRequest, NextResponse } from 'next/server'
import type { Prisma, ReportCadence, ReportCategory } from '@prisma/client'

import { checkFeature } from '@/lib/entitlements'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const CADENCES = new Set(['WEEKLY', 'MONTHLY', 'QUARTERLY'])
const CATEGORIES = new Set(['ETF', 'MACRO', 'ONCHAIN'])

// Published research reports (Institutional+, reports.premium).
export async function GET(request: NextRequest) {
  const gate = await checkFeature('reports.premium')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }

  const params = request.nextUrl.searchParams
  const locale = params.get('locale') === 'en' ? 'en' : 'ko'
  const cadence = params.get('cadence')?.toUpperCase() ?? ''
  const category = params.get('category')?.toUpperCase() ?? ''

  const where: Prisma.ReportWhereInput = { status: 'PUBLISHED', locale }
  if (CADENCES.has(cadence)) where.cadence = cadence as ReportCadence
  if (CATEGORIES.has(category)) where.category = category as ReportCategory

  const reports = await prisma.report.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: {
      slug: true,
      title: true,
      summary: true,
      cadence: true,
      category: true,
      periodKey: true,
      aiModel: true,
      publishedAt: true,
    },
  })

  return NextResponse.json({ items: reports })
}
