import { NextRequest, NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { prisma } from '@/lib/prisma'
import type { BriefSections } from '@/lib/brief/guidelines'

export const dynamic = 'force-dynamic'

// Latest published brief, resolved against the requester's plan:
//   FREE                → locked: only the "today" section (teaser)
//   STANDARD            → full STANDARD brief
//   PROFESSIONAL and up → DETAILED brief (or ?tier=standard)
// Content is non-personalized — identical for every subscriber of a tier.
export async function GET(request: NextRequest) {
  const [daily, detailed] = await Promise.all([
    checkFeature('brief.daily'),
    checkFeature('brief.detailed'),
  ])

  const requested = request.nextUrl.searchParams.get('tier')
  const tier =
    detailed.allowed && requested !== 'standard'
      ? 'DETAILED'
      : 'STANDARD'

  const brief = await prisma.marketBrief.findFirst({
    where: { tier, status: 'PUBLISHED' },
    orderBy: { briefDate: 'desc' },
  })

  if (!brief) {
    return NextResponse.json({ available: false, locked: !daily.allowed, tier: tier.toLowerCase() })
  }

  const sections = brief.sections as unknown as BriefSections

  if (!daily.allowed) {
    // Teaser for FREE / signed-out: today's synthesis only.
    return NextResponse.json({
      available: true,
      locked: true,
      tier: 'standard',
      briefDate: brief.briefDate,
      aiModel: brief.aiModel,
      sections: { today: sections.today },
      reason: daily.reason,
      requiredPlan: daily.requiredPlan,
    })
  }

  return NextResponse.json({
    available: true,
    locked: false,
    tier: tier.toLowerCase(),
    detailedAvailable: detailed.allowed,
    briefDate: brief.briefDate,
    aiModel: brief.aiModel,
    publishedAt: brief.updatedAt,
    sections,
  })
}
