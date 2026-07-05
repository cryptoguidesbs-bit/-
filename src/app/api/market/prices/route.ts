import { NextRequest, NextResponse } from 'next/server'

import { resilientFetch } from '@/lib/market/resilient'
import { cryptoSources } from '@/lib/market/sources'
import { testControls } from '@/lib/market/request-helpers'

export const dynamic = 'force-dynamic'

// BTC / ETH / SOL — CryptoCompare primary, Binance fallback, last-good cache.
export async function GET(request: NextRequest) {
  const { blocked, cacheSuffix } = testControls(request)
  const result = await resilientFetch(`crypto-prices${cacheSuffix}`, cryptoSources, {
    timeoutMs: 5_000,
    retries: 1,
    freshMs: 20_000,
    blocked,
  })
  return NextResponse.json(result)
}
