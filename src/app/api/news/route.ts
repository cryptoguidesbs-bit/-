import { NextRequest, NextResponse } from 'next/server'
import type { NewsCategory, NewsRegion, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const CATEGORIES = new Set(['MARKET', 'REGULATION', 'TECHNOLOGY', 'DEFI', 'MACRO', 'GENERAL'])
const REGIONS = new Set(['US', 'EUROPE', 'ASIA', 'GLOBAL'])
const PAGE_SIZE = 20

// News listing with search + category/region filters. Includes PUBLISHED
// items (with AI summaries) and PENDING/HELD items (headline only — their
// summaries are not shown until they pass sanity checks).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const query = params.get('query')?.trim() ?? ''
  const category = params.get('category') ?? ''
  const region = params.get('region') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const limit = Math.min(50, Math.max(1, Number(params.get('limit') ?? PAGE_SIZE) || PAGE_SIZE))

  const where: Prisma.NewsItemWhereInput = {}
  if (query) where.title = { contains: query, mode: 'insensitive' }
  if (CATEGORIES.has(category)) where.category = category as NewsCategory
  if (REGIONS.has(region)) where.region = region as NewsRegion

  const [total, items] = await Promise.all([
    prisma.newsItem.count({ where }),
    prisma.newsItem.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        url: true,
        source: true,
        region: true,
        category: true,
        publishedAt: true,
        aiStatus: true,
        summaryKo: true,
        summaryEn: true,
        sentiment: true,
        confidence: true,
        aiModel: true,
      },
    }),
  ])

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      // Only published summaries are exposed; held/pending stay hidden.
      summaryKo: item.aiStatus === 'PUBLISHED' ? item.summaryKo : null,
      summaryEn: item.aiStatus === 'PUBLISHED' ? item.summaryEn : null,
      sentiment: item.aiStatus === 'PUBLISHED' ? item.sentiment : null,
      confidence: item.aiStatus === 'PUBLISHED' ? item.confidence : null,
      aiGenerated: item.aiStatus === 'PUBLISHED',
    })),
    page,
    total,
    hasMore: page * limit < total,
  })
}
