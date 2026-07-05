import { NextRequest, NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { resilientFetch } from '@/lib/market/resilient'
import { getUsdQuotes } from '@/lib/market/quotes'
import { testControls } from '@/lib/market/request-helpers'
import { whaleSources, type WhaleData } from '@/lib/onchain/sources'

export const dynamic = 'force-dynamic'

// Whale tracker + exchange-flow estimate. Institutional+ (onchain.advanced),
// region policy applies.
export async function GET(request: NextRequest) {
  const gate = await checkFeature('onchain.advanced')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }

  const { blocked, cacheSuffix } = testControls(request)
  const result = await resilientFetch<WhaleData>(`onchain-whales${cacheSuffix}`, whaleSources, {
    timeoutMs: 10_000,
    retries: 1,
    freshMs: 60_000,
    blocked,
  })

  // Mempool-derived values are measured in BTC — convert to USD here.
  if (result.data) {
    const quotes = await getUsdQuotes(['BTC'])
    const btc = quotes.BTC ?? 0
    if (result.data.flow) {
      const flow = result.data.flow
      result.data.flow = {
        ...flow,
        inflowUsd: flow.inflowUsd * btc,
        outflowUsd: flow.outflowUsd * btc,
        netUsd: flow.netUsd * btc,
      }
    }
    result.data.txs = result.data.txs.map((tx) =>
      tx.valueUsd === 0 ? { ...tx, valueUsd: tx.valueBtc * btc } : tx,
    )
  }

  return NextResponse.json(result)
}
