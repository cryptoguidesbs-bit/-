import { NextRequest, NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { getAiProvider, AiRateLimitError } from '@/lib/ai/provider'
import { consumeAiBudget, AiBudgetExceededError } from '@/lib/ai/budget'
import { computeAnalytics } from '@/lib/portfolio/analytics'
import { checkPortfolioCommentary } from '@/lib/portfolio/guidelines'
import { getUsdQuotes } from '@/lib/market/quotes'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/me/portfolio/insight — AI educational commentary on the
// portfolio's diversification metrics (principle A-2-7: explanation only,
// directives are blocked).
//
// Privacy: only structural metrics (weights %, HHI) reach the model — no
// amounts, no identifiers. The commentary is returned ephemerally and never
// persisted.
export async function POST(request: NextRequest) {
  const gate = await checkFeature('portfolio.tools')
  if (!gate.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: gate.reason === 'auth' ? 401 : 403 })
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { mockScenario?: string }
  const mockScenario =
    process.env.NODE_ENV !== 'production' && typeof body.mockScenario === 'string'
      ? body.mockScenario
      : undefined

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

  const d = analytics.diversification
  if (
    d.hhi === null ||
    d.effectiveAssets === null ||
    d.topSymbol === null ||
    d.topWeightPct === null ||
    d.concentration === null
  ) {
    return NextResponse.json({ error: 'not enough priced holdings' }, { status: 422 })
  }

  const provider = getAiProvider()
  try {
    await consumeAiBudget()
    const commentary = await provider.explainPortfolio({
      weights: analytics.holdings
        .filter((h) => h.weightPct !== null)
        .map((h) => ({ symbol: h.symbol, weightPct: h.weightPct as number })),
      hhi: d.hhi,
      effectiveAssets: d.effectiveAssets,
      topSymbol: d.topSymbol,
      topWeightPct: d.topWeightPct,
      concentration: d.concentration,
      mockScenario,
    })

    const verdict = checkPortfolioCommentary(commentary)
    if (!verdict.ok) {
      // A-2-7 violation: never show directive output.
      return NextResponse.json(
        { blocked: true, reason: verdict.reason },
        { status: 422 },
      )
    }

    return NextResponse.json({
      blocked: false,
      commentary,
      aiModel: provider.model,
    })
  } catch (error) {
    if (error instanceof AiBudgetExceededError || error instanceof AiRateLimitError) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }
    console.error('[portfolio/insight]', error)
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
