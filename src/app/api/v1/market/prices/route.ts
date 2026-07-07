import { NextRequest, NextResponse } from 'next/server'

import { authenticateApiKey, rateHeaders } from '@/lib/api/auth'
import { apiMeta } from '@/lib/api/meta'
import { resilientFetch } from '@/lib/market/resilient'
import { cryptoSources } from '@/lib/market/sources'

export const dynamic = 'force-dynamic'

// GET /api/v1/market/prices — BTC/ETH/SOL USD quotes (Legendary API).
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request, 'market/prices')
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: rateHeaders(auth.rate) },
    )
  }

  const result = await resilientFetch('crypto-prices', cryptoSources, {
    timeoutMs: 5_000,
    retries: 1,
    freshMs: 20_000,
  })
  return NextResponse.json(
    { data: result.data, stale: result.stale, updatedAt: result.updatedAt, meta: apiMeta() },
    { headers: rateHeaders(auth.rate) },
  )
}
