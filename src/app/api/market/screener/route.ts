import { NextRequest, NextResponse } from 'next/server'

import { resilientFetch } from '@/lib/market/resilient'
import { screenerSources } from '@/lib/market/screener-sources'
import { testControls } from '@/lib/market/request-helpers'

export const dynamic = 'force-dynamic'

// Top-100 coin table for the screener — one upstream call every 2 minutes
// serves every visitor (CoinGecko → CoinPaprika, last-good cache).
export async function GET(request: NextRequest) {
  const { blocked, cacheSuffix } = testControls(request)
  const result = await resilientFetch(`screener${cacheSuffix}`, screenerSources, {
    timeoutMs: 8_000,
    retries: 1,
    freshMs: 2 * 60_000,
    blocked,
  })
  return NextResponse.json(result)
}
