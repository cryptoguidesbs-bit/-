import { NextRequest, NextResponse } from 'next/server'

import { resilientFetch } from '@/lib/market/resilient'
import { indicesSources } from '@/lib/market/sources'
import { testControls } from '@/lib/market/request-helpers'

export const dynamic = 'force-dynamic'

// NASDAQ / S&P 500 / KOSPI / Gold / WTI / Dollar Index — Yahoo Finance with
// mirror fallback, last-good cache.
export async function GET(request: NextRequest) {
  const { blocked, cacheSuffix } = testControls(request)
  const result = await resilientFetch(`indices${cacheSuffix}`, indicesSources, {
    timeoutMs: 8_000,
    retries: 1,
    freshMs: 60_000,
    blocked,
  })
  return NextResponse.json(result)
}
