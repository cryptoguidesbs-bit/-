// ---------------------------------------------------------------------------
// Portfolio analytics — pure, deterministic functions (no I/O) so the math
// is directly verifiable: P&L, allocation, diversification (HHI).
// ---------------------------------------------------------------------------

export type HoldingInput = {
  symbol: string
  quantity: number
  avgCost: number
  price: number | null
}

export type HoldingAnalytics = {
  symbol: string
  quantity: number
  avgCost: number
  price: number | null
  /** quantity × price (null when the symbol has no quote). */
  value: number | null
  /** quantity × avgCost. */
  cost: number
  /** value − cost (null when unpriced). */
  pnl: number | null
  /** pnl / cost × 100 (null when unpriced or cost is 0). */
  pnlPct: number | null
  /** Share of total priced value, 0–100 (null when unpriced). */
  weightPct: number | null
}

export type PortfolioAnalytics = {
  holdings: HoldingAnalytics[]
  totals: {
    value: number
    cost: number
    pnl: number
    pnlPct: number | null
    pricedCount: number
    unpricedCount: number
  }
  diversification: {
    /** Herfindahl–Hirschman index over weights (0–1). 1 = single asset. */
    hhi: number | null
    /** 1 / HHI — the "effective" number of equally-weighted assets. */
    effectiveAssets: number | null
    topSymbol: string | null
    topWeightPct: number | null
    /** Descriptive label (not advice): diversified / moderate / concentrated. */
    concentration: 'diversified' | 'moderate' | 'concentrated' | null
  }
}

export function computeAnalytics(holdings: HoldingInput[]): PortfolioAnalytics {
  const priced = holdings.filter((h) => h.price !== null)
  const totalValue = priced.reduce((sum, h) => sum + h.quantity * (h.price as number), 0)
  const totalCostPriced = priced.reduce((sum, h) => sum + h.quantity * h.avgCost, 0)
  const totalCostAll = holdings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0)

  const rows: HoldingAnalytics[] = holdings.map((h) => {
    const cost = h.quantity * h.avgCost
    if (h.price === null) {
      return { ...h, value: null, cost, pnl: null, pnlPct: null, weightPct: null }
    }
    const value = h.quantity * h.price
    const pnl = value - cost
    return {
      ...h,
      value,
      cost,
      pnl,
      pnlPct: cost > 0 ? (pnl / cost) * 100 : null,
      weightPct: totalValue > 0 ? (value / totalValue) * 100 : null,
    }
  })

  const totalPnl = totalValue - totalCostPriced

  let hhi: number | null = null
  let effectiveAssets: number | null = null
  let topSymbol: string | null = null
  let topWeightPct: number | null = null
  let concentration: PortfolioAnalytics['diversification']['concentration'] = null

  if (totalValue > 0 && priced.length > 0) {
    hhi = priced.reduce((sum, h) => {
      const weight = (h.quantity * (h.price as number)) / totalValue
      return sum + weight * weight
    }, 0)
    effectiveAssets = 1 / hhi
    const top = rows
      .filter((r) => r.weightPct !== null)
      .sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0))[0]
    topSymbol = top?.symbol ?? null
    topWeightPct = top?.weightPct ?? null
    concentration = hhi < 0.15 ? 'diversified' : hhi <= 0.25 ? 'moderate' : 'concentrated'
  }

  return {
    holdings: rows,
    totals: {
      value: totalValue,
      cost: totalCostAll,
      pnl: totalPnl,
      pnlPct: totalCostPriced > 0 ? (totalPnl / totalCostPriced) * 100 : null,
      pricedCount: priced.length,
      unpricedCount: holdings.length - priced.length,
    },
    diversification: { hhi, effectiveAssets, topSymbol, topWeightPct, concentration },
  }
}
