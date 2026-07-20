import { NextRequest, NextResponse } from 'next/server'

import { authenticateApiKey, rateHeaders } from '@/lib/api/auth'
import { apiMeta } from '@/lib/api/meta'
import { resilientFetch } from '@/lib/market/resilient'
import { sentimentSources } from '@/lib/market/sources'

export const dynamic = 'force-dynamic'

// GET /api/v1/market/sentiment — Fear & Greed index (Whale API).
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request, 'market/sentiment')
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: rateHeaders(auth.rate) },
    )
  }

  const result = await resilientFetch('sentiment', sentimentSources, {
    timeoutMs: 5_000,
    retries: 1,
    freshMs: 5 * 60_000,
  })
  return NextResponse.json(
    { data: result.data, stale: result.stale, updatedAt: result.updatedAt, meta: apiMeta() },
    { headers: rateHeaders(auth.rate) },
  )
}
