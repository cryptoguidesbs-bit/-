import { NextRequest, NextResponse } from 'next/server'

import { authenticateApiKey, rateHeaders } from '@/lib/api/auth'
import { apiMeta } from '@/lib/api/meta'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/v1/briefs/latest — the latest published AI Market Brief
// (detailed tier; Legendary API). AI-generated, non-personalized.
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request, 'briefs/latest')
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: rateHeaders(auth.rate) },
    )
  }

  const brief = await prisma.marketBrief.findFirst({
    where: { status: 'PUBLISHED', tier: 'DETAILED' },
    orderBy: { briefDate: 'desc' },
    select: { briefDate: true, tier: true, sections: true, aiModel: true, createdAt: true },
  })

  return NextResponse.json(
    {
      data: brief
        ? { ...brief, aiGenerated: true }
        : null,
      meta: apiMeta(),
    },
    { headers: rateHeaders(auth.rate) },
  )
}
