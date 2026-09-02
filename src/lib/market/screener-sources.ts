import 'server-only'

import { fetchJson, type Source } from './resilient'

// Top-100 coins by market cap for the Coin Screener. Plain market data only
// (price, changes, volume, market cap) — no derived "signals". CoinGecko
// primary (one call, 1h/24h/7d changes), CoinPaprika fallback.

export const SCREENER_SIZE = 100

export type ScreenerRow = {
  rank: number
  id: string
  symbol: string
  name: string
  price: number
  change1hPct: number | null
  change24hPct: number | null
  change7dPct: number | null
  volume24hUsd: number
  marketCapUsd: number
}

type CoinGeckoRow = {
  id: string
  symbol: string
  name: string
  market_cap_rank?: number | null
  current_price?: number | null
  market_cap?: number | null
  total_volume?: number | null
  price_change_percentage_1h_in_currency?: number | null
  price_change_percentage_24h_in_currency?: number | null
  price_change_percentage_7d_in_currency?: number | null
}

type CoinPaprikaRow = {
  id: string
  symbol: string
  name: string
  rank?: number
  quotes?: {
    USD?: {
      price?: number
      volume_24h?: number
      market_cap?: number
      percent_change_1h?: number
      percent_change_24h?: number
      percent_change_7d?: number
    }
  }
}

const num = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

export const screenerSources: Source<ScreenerRow[]>[] = [
  {
    name: 'coingecko-markets',
    async fetch(signal) {
      const url =
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc' +
        `&per_page=${SCREENER_SIZE}&page=1&price_change_percentage=1h,24h,7d`
      const json = await fetchJson<CoinGeckoRow[]>(url, signal, 'coingecko-markets')
      const rows = json
        .filter((r) => typeof r.current_price === 'number')
        .map((r, i) => ({
          rank: r.market_cap_rank ?? i + 1,
          id: r.id,
          symbol: r.symbol.toUpperCase(),
          name: r.name,
          price: r.current_price as number,
          change1hPct: num(r.price_change_percentage_1h_in_currency),
          change24hPct: num(r.price_change_percentage_24h_in_currency),
          change7dPct: num(r.price_change_percentage_7d_in_currency),
          volume24hUsd: r.total_volume ?? 0,
          marketCapUsd: r.market_cap ?? 0,
        }))
      if (rows.length < 20) throw new Error('coingecko-markets too few rows')
      return rows
    },
  },
  {
    name: 'coinpaprika-tickers',
    async fetch(signal) {
      const json = await fetchJson<CoinPaprikaRow[]>(
        'https://api.coinpaprika.com/v1/tickers?quotes=USD',
        signal,
        'coinpaprika-tickers'
      )
      const rows = json
        .filter(
          (r) =>
            typeof r.rank === 'number' && r.rank > 0 && typeof r.quotes?.USD?.price === 'number'
        )
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        .slice(0, SCREENER_SIZE)
        .map((r) => {
          const usd = r.quotes?.USD ?? {}
          return {
            rank: r.rank as number,
            id: r.id,
            symbol: r.symbol.toUpperCase(),
            name: r.name,
            price: usd.price as number,
            change1hPct: num(usd.percent_change_1h),
            change24hPct: num(usd.percent_change_24h),
            change7dPct: num(usd.percent_change_7d),
            volume24hUsd: usd.volume_24h ?? 0,
            marketCapUsd: usd.market_cap ?? 0,
          }
        })
      if (rows.length < 20) throw new Error('coinpaprika-tickers too few rows')
      return rows
    },
  },
]
