import { NextResponse } from 'next/server'

import { BINANCE_REST_URL, marketSymbols } from '@/config/market'

export const revalidate = 10

type BinanceTicker = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
}

// Initial price snapshot for the ticker/dashboard. The browser then keeps
// itself up to date over the Binance WebSocket stream; this route only
// covers first paint and WS-unavailable fallback.
export async function GET() {
  try {
    const symbols = JSON.stringify(marketSymbols.map((m) => m.symbol))
    const res = await fetch(
      `${BINANCE_REST_URL}/ticker/24hr?symbols=${encodeURIComponent(symbols)}`,
      { next: { revalidate: 10 } },
    )
    if (!res.ok) throw new Error(`Binance responded ${res.status}`)

    const data = (await res.json()) as BinanceTicker[]
    return NextResponse.json({
      tickers: data.map((t) => ({
        symbol: t.symbol,
        price: Number(t.lastPrice),
        changePct: Number(t.priceChangePercent),
        volumeQuote: Number(t.quoteVolume),
      })),
    })
  } catch {
    // Degrade gracefully — the UI shows skeletons until data arrives.
    return NextResponse.json({ tickers: [] })
  }
}
