import 'server-only'

import { BINANCE_REST_URL } from '@/config/market'
import { assertUpstreamOk, resilientFetch, type Source } from './resilient'

// USD spot prices for arbitrary crypto symbols (portfolio/watchlist
// enrichment). One cached fetch of Binance's full price list serves all
// requests; symbols without a USDT pair resolve to null.

type PriceRow = { symbol: string; price: string }

const allPricesSource: Source<Record<string, number>> = {
  name: 'binance-all-prices',
  async fetch(signal) {
    const res = await fetch(`${BINANCE_REST_URL}/ticker/price`, { signal, cache: 'no-store' })
    assertUpstreamOk(res, 'binance-all-prices')
    const rows = (await res.json()) as PriceRow[]
    const map: Record<string, number> = {}
    for (const row of rows) {
      if (row.symbol.endsWith('USDT')) {
        map[row.symbol.slice(0, -4)] = Number(row.price)
      }
    }
    return map
  },
}

export async function getUsdQuotes(symbols: string[]): Promise<Record<string, number | null>> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())))
  const out: Record<string, number | null> = {}
  if (unique.length === 0) return out

  const result = await resilientFetch('binance-all-usdt-prices', [allPricesSource], {
    timeoutMs: 6_000,
    retries: 1,
    freshMs: 15_000,
  })
  const map = result.data ?? {}

  for (const symbol of unique) {
    if (symbol === 'USDT' || symbol === 'USD') out[symbol] = 1
    else out[symbol] = map[symbol] ?? null
  }
  return out
}
