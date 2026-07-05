import { NextRequest, NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { resilientFetch } from '@/lib/market/resilient'
import { testControls } from '@/lib/market/request-helpers'
import {
  networkSources,
  stablecoinSources,
  type NetworkData,
  type StablecoinData,
} from '@/lib/onchain/sources'

export const dynamic = 'force-dynamic'

// Network activity (active addresses, tx count, hash rate, miner revenue)
// + stablecoin supply. Institutional+ (onchain.advanced), region policy
// applies.
export async function GET(request: NextRequest) {
  const gate = await checkFeature('onchain.advanced')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }

  const { blocked, cacheSuffix } = testControls(request)
  const [network, stablecoins] = await Promise.all([
    resilientFetch<NetworkData>(`onchain-network${cacheSuffix}`, networkSources, {
      timeoutMs: 12_000,
      retries: 1,
      freshMs: 10 * 60_000,
      blocked,
    }),
    resilientFetch<StablecoinData>(`onchain-stablecoins${cacheSuffix}`, stablecoinSources, {
      timeoutMs: 8_000,
      retries: 1,
      freshMs: 10 * 60_000,
      blocked,
    }),
  ])

  return NextResponse.json({ network, stablecoins })
}
