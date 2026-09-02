import { NextRequest, NextResponse } from 'next/server'

import { computeMarketScore } from '@/lib/market/score'
import { testControls } from '@/lib/market/request-helpers'

export const dynamic = 'force-dynamic'

// Market Score (v1): 0–100 market-condition gauge computed from inputs the
// site already serves (BTC move, market cap change, breadth, Fear & Greed,
// news tone, stability). Public. Missing inputs are reported, never faked.
export async function GET(request: NextRequest) {
  const { blocked, cacheSuffix } = testControls(request)
  const score = await computeMarketScore({ blocked, cacheSuffix })
  return NextResponse.json(score)
}
