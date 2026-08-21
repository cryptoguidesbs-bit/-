import { NextResponse } from 'next/server'

import { resilientFetch } from '@/lib/market/resilient'
import { tickerSources } from '@/lib/market/sources'

export const dynamic = 'force-dynamic'

// Initial price snapshot for the ticker/dashboard. The browser then keeps
// itself up to date over the Binance WebSocket stream where reachable; this
// route covers first paint and the WS-unavailable polling fallback.
// CoinGecko primary / CoinPaprika / Binance — see sources.ts for why.
export async function GET() {
  const result = await resilientFetch('market-tickers', tickerSources, {
    timeoutMs: 5_000,
    retries: 1,
    freshMs: 15_000,
  })
  // Degrade gracefully — the UI shows skeletons until data arrives.
  return NextResponse.json({ tickers: result.data ?? [] })
}
