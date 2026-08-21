import { NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { resilientFetch } from '@/lib/market/resilient'
import { tickerSources } from '@/lib/market/sources'

// Whale-only data export (CSV) — the first concrete "data.export"
// consumer. Also demonstrates route-level entitlement gating.
// Shares the resilient ticker snapshot (CoinGecko/CoinPaprika/Binance).
export async function GET() {
  const gate = await checkFeature('data.export')
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: 'forbidden',
        reason: gate.reason,
        requiredPlan: gate.requiredPlan,
      },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }

  const result = await resilientFetch('market-tickers', tickerSources, {
    timeoutMs: 5_000,
    retries: 1,
    freshMs: 15_000,
  })
  if (!result.data) {
    return NextResponse.json({ error: 'export failed' }, { status: 502 })
  }

  const rows = [
    'symbol,price_usd,change_24h_pct,volume_24h_usd',
    ...result.data.map((t) => `${t.symbol},${t.price},${t.changePct},${t.volumeQuote}`),
  ]

  return new NextResponse(rows.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="cryptoguide-market-export.csv"',
    },
  })
}
