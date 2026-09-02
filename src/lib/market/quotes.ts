import 'server-only'

import { BINANCE_REST_URL } from '@/config/market'
import { fetchJson, resilientFetch, type Source } from './resilient'

// USD spot prices for arbitrary crypto symbols (portfolio/watchlist
// enrichment). One cached fetch of a full price list serves all requests;
// unknown symbols resolve to null. Binance first (fast, works locally/non-US);
// CoinPaprika fallback because Binance 451s from US IPs (Vercel US East).

type PriceRow = { symbol: string; price: string }

const allPricesSource: Source<Record<string, number>> = {
  name: 'binance-all-prices',
  async fetch(signal) {
    const rows = await fetchJson<PriceRow[]>(
      `${BINANCE_REST_URL}/ticker/price`,
      signal,
      'binance-all-prices'
    )
    const map: Record<string, number> = {}
    for (const row of rows) {
      if (row.symbol.endsWith('USDT')) {
        map[row.symbol.slice(0, -4)] = Number(row.price)
      }
    }
    return map
  },
}

type PaprikaRow = { symbol?: string; rank?: number; quotes?: { USD?: { price?: number } } }

const paprikaAllPricesSource: Source<Record<string, number>> = {
  name: 'coinpaprika-all-prices',
  async fetch(signal) {
    const rows = await fetchJson<PaprikaRow[]>(
      'https://api.coinpaprika.com/v1/tickers?quotes=USD',
      signal,
      'coinpaprika-all-prices'
    )
    const map: Record<string, number> = {}
    // Rows are rank-ordered; many coins share a symbol, so first (highest
    // market cap) wins — matches what users mean by "BTC", "ETH", ….
    for (const row of rows) {
      const symbol = row.symbol?.toUpperCase()
      const price = row.quotes?.USD?.price
      if (symbol && typeof price === 'number' && !(symbol in map)) {
        map[symbol] = price
      }
    }
    return map
  },
}

export async function getUsdQuotes(symbols: string[]): Promise<Record<string, number | null>> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())))
  const out: Record<string, number | null> = {}
  if (unique.length === 0) return out

  const result = await resilientFetch(
    'all-usd-spot-prices',
    [allPricesSource, paprikaAllPricesSource],
    {
      timeoutMs: 6_000,
      retries: 1,
      freshMs: 15_000,
    }
  )
  const map = result.data ?? {}

  for (const symbol of unique) {
    if (symbol === 'USDT' || symbol === 'USD') out[symbol] = 1
    else out[symbol] = map[symbol] ?? null
  }
  return out
}
