import { NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { BINANCE_REST_URL, marketSymbols } from '@/config/market'

type BinanceTicker = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
}

// Legendary-only data export (CSV) — the first concrete "data.export"
// consumer. Also demonstrates route-level entitlement gating.
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

  try {
    const symbols = JSON.stringify(marketSymbols.map((m) => m.symbol))
    const res = await fetch(
      `${BINANCE_REST_URL}/ticker/24hr?symbols=${encodeURIComponent(symbols)}`,
      { next: { revalidate: 10 } },
    )
    if (!res.ok) throw new Error(`Binance responded ${res.status}`)
    const data = (await res.json()) as BinanceTicker[]

    const rows = [
      'symbol,price_usd,change_24h_pct,volume_24h_usd',
      ...data.map(
        (t) =>
          `${t.symbol},${Number(t.lastPrice)},${Number(t.priceChangePercent)},${Number(t.quoteVolume)}`,
      ),
    ]

    return new NextResponse(rows.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="cryptoguide-market-export.csv"',
      },
    })
  } catch {
    return NextResponse.json({ error: 'export failed' }, { status: 502 })
  }
}
