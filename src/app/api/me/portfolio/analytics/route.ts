import { NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { computeAnalytics } from '@/lib/portfolio/analytics'
import { getUsdQuotes } from '@/lib/market/quotes'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/me/portfolio/analytics — P&L, allocation, diversification.
export async function GET() {
  const gate = await checkFeature('portfolio.tools')
  if (!gate.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: gate.reason === 'auth' ? 401 : 403 })
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const portfolio = await prisma.portfolio.findFirst({ where: { userId: user.id } })
  const items = portfolio
    ? await prisma.portfolioItem.findMany({ where: { portfolioId: portfolio.id } })
    : []
  const quotes = await getUsdQuotes(items.map((i) => i.symbol))

  const analytics = computeAnalytics(
    items.map((item) => ({
      symbol: item.symbol,
      quantity: Number(item.quantity),
      avgCost: Number(item.avgCost),
      price: quotes[item.symbol.toUpperCase()] ?? null,
    })),
  )

  return NextResponse.json(analytics)
}
