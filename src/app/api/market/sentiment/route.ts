import { NextRequest, NextResponse } from 'next/server'

import { resilientFetch } from '@/lib/market/resilient'
import { sentimentSources } from '@/lib/market/sources'
import { testControls } from '@/lib/market/request-helpers'

export const dynamic = 'force-dynamic'

// Crypto Fear & Greed index (Alternative.me), last-good cache.
export async function GET(request: NextRequest) {
  const { blocked, cacheSuffix } = testControls(request)
  const result = await resilientFetch(`sentiment${cacheSuffix}`, sentimentSources, {
    timeoutMs: 5_000,
    retries: 1,
    freshMs: 5 * 60_000,
    blocked,
  })
  return NextResponse.json(result)
}
