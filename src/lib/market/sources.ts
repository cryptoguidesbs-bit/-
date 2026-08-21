import 'server-only'

import { BINANCE_REST_URL, marketSymbols } from '@/config/market'
import { cryptoAssets, traditionalAssets } from '@/config/assets'
import { assertUpstreamOk, type Source } from './resilient'

// ---------------------------------------------------------------------------
// Shared shapes served to the client
// ---------------------------------------------------------------------------

export type AssetQuote = {
  id: string
  name: string
  price: number
  changePct: number
}

export type SentimentData = {
  value: number
  classification: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// Crypto prices — CoinGecko primary, CoinPaprika fallback, Binance last.
// (CryptoCompare was dropped: its free min-api now requires an API key, and
// Binance rejects US IPs with 451 — Vercel's default region is US East, so
// both former sources fail in production. CoinGecko/CoinPaprika are keyless
// and reachable from US datacenters; Binance stays for non-US/local runs.)
// ---------------------------------------------------------------------------

const COINGECKO_URL = 'https://api.coingecko.com/api/v3'
const COINPAPRIKA_URL = 'https://api.coinpaprika.com/v1'

type CoinGeckoMarket = {
  id: string
  current_price?: number
  price_change_percentage_24h?: number | null
  total_volume?: number
}

type CoinPaprikaTicker = {
  quotes?: { USD?: { price?: number; percent_change_24h?: number; volume_24h?: number } }
}

export const cryptoSources: Source<AssetQuote[]>[] = [
  {
    name: 'coingecko',
    async fetch(signal) {
      const ids = cryptoAssets.map((a) => a.coingeckoId).join(',')
      const res = await fetch(`${COINGECKO_URL}/coins/markets?vs_currency=usd&ids=${ids}`, {
        signal,
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      assertUpstreamOk(res, 'coingecko')
      const json = (await res.json()) as CoinGeckoMarket[]
      return cryptoAssets.map((asset) => {
        const row = json.find((r) => r.id === asset.coingeckoId)
        if (typeof row?.current_price !== 'number') {
          throw new Error(`coingecko missing ${asset.id}`)
        }
        return {
          id: asset.id,
          name: asset.name,
          price: row.current_price,
          changePct: row.price_change_percentage_24h ?? 0,
        }
      })
    },
  },
  {
    name: 'coinpaprika',
    async fetch(signal) {
      return Promise.all(
        cryptoAssets.map(async (asset) => {
          const res = await fetch(`${COINPAPRIKA_URL}/tickers/${asset.paprikaId}`, {
            signal,
            cache: 'no-store',
          })
          assertUpstreamOk(res, 'coinpaprika')
          const json = (await res.json()) as CoinPaprikaTicker
          const usd = json.quotes?.USD
          if (typeof usd?.price !== 'number') throw new Error(`coinpaprika missing ${asset.id}`)
          return {
            id: asset.id,
            name: asset.name,
            price: usd.price,
            changePct: usd.percent_change_24h ?? 0,
          }
        }),
      )
    },
  },
  {
    name: 'binance',
    async fetch(signal) {
      const symbols = JSON.stringify(cryptoAssets.map((a) => a.binanceSymbol))
      const res = await fetch(
        `${BINANCE_REST_URL}/ticker/24hr?symbols=${encodeURIComponent(symbols)}`,
        { signal, cache: 'no-store' },
      )
      assertUpstreamOk(res, 'binance')
      const json = (await res.json()) as {
        symbol: string
        lastPrice: string
        priceChangePercent: string
      }[]
      return cryptoAssets.map((asset) => {
        const t = json.find((x) => x.symbol === asset.binanceSymbol)
        if (!t) throw new Error(`binance missing ${asset.binanceSymbol}`)
        return {
          id: asset.id,
          name: asset.name,
          price: Number(t.lastPrice),
          changePct: Number(t.priceChangePercent),
        }
      })
    },
  },
]

// ---------------------------------------------------------------------------
// Ticker snapshot (8 symbols incl. volume) for the live ticker / dashboard —
// same source order and reasoning as cryptoSources above.
// ---------------------------------------------------------------------------

export type TickerQuote = {
  symbol: string
  price: number
  changePct: number
  volumeQuote: number
}

export const tickerSources: Source<TickerQuote[]>[] = [
  {
    name: 'coingecko',
    async fetch(signal) {
      const ids = marketSymbols.map((m) => m.coingeckoId).join(',')
      const res = await fetch(`${COINGECKO_URL}/coins/markets?vs_currency=usd&ids=${ids}`, {
        signal,
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      assertUpstreamOk(res, 'coingecko')
      const json = (await res.json()) as CoinGeckoMarket[]
      return marketSymbols.map((m) => {
        const row = json.find((r) => r.id === m.coingeckoId)
        if (typeof row?.current_price !== 'number') {
          throw new Error(`coingecko missing ${m.symbol}`)
        }
        return {
          symbol: m.symbol,
          price: row.current_price,
          changePct: row.price_change_percentage_24h ?? 0,
          volumeQuote: row.total_volume ?? 0,
        }
      })
    },
  },
  {
    name: 'coinpaprika',
    async fetch(signal) {
      return Promise.all(
        marketSymbols.map(async (m) => {
          const res = await fetch(`${COINPAPRIKA_URL}/tickers/${m.paprikaId}`, {
            signal,
            cache: 'no-store',
          })
          assertUpstreamOk(res, 'coinpaprika')
          const json = (await res.json()) as CoinPaprikaTicker
          const usd = json.quotes?.USD
          if (typeof usd?.price !== 'number') throw new Error(`coinpaprika missing ${m.symbol}`)
          return {
            symbol: m.symbol,
            price: usd.price,
            changePct: usd.percent_change_24h ?? 0,
            volumeQuote: usd.volume_24h ?? 0,
          }
        }),
      )
    },
  },
  {
    name: 'binance',
    async fetch(signal) {
      const symbols = JSON.stringify(marketSymbols.map((m) => m.symbol))
      const res = await fetch(
        `${BINANCE_REST_URL}/ticker/24hr?symbols=${encodeURIComponent(symbols)}`,
        { signal, cache: 'no-store' },
      )
      assertUpstreamOk(res, 'binance')
      const json = (await res.json()) as {
        symbol: string
        lastPrice: string
        priceChangePercent: string
        quoteVolume: string
      }[]
      return marketSymbols.map((m) => {
        const t = json.find((x) => x.symbol === m.symbol)
        if (!t) throw new Error(`binance missing ${m.symbol}`)
        return {
          symbol: m.symbol,
          price: Number(t.lastPrice),
          changePct: Number(t.priceChangePercent),
          volumeQuote: Number(t.quoteVolume),
        }
      })
    },
  },
]

// ---------------------------------------------------------------------------
// Traditional assets (indices / commodities / FX) — Yahoo Finance chart API,
// query1 primary with the query2 mirror as fallback
// ---------------------------------------------------------------------------

type YahooChart = {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number
        chartPreviousClose?: number
        previousClose?: number
      }
    }[]
  }
}

function yahooSource(host: string): Source<AssetQuote[]> {
  return {
    name: host,
    async fetch(signal) {
      const quotes = await Promise.all(
        traditionalAssets.map(async (asset) => {
          const res = await fetch(
            `https://${host}/v8/finance/chart/${encodeURIComponent(asset.yahooSymbol)}?range=1d&interval=1d`,
            {
              signal,
              cache: 'no-store',
              headers: { 'user-agent': 'Mozilla/5.0 (compatible; CryptoGuide/1.0)' },
            },
          )
          assertUpstreamOk(res, host)
          const json = (await res.json()) as YahooChart
          const meta = json.chart?.result?.[0]?.meta
          const price = meta?.regularMarketPrice
          const prev = meta?.chartPreviousClose ?? meta?.previousClose
          if (typeof price !== 'number' || typeof prev !== 'number' || prev === 0) {
            throw new Error(`${host} missing data for ${asset.yahooSymbol}`)
          }
          return {
            id: asset.id,
            name: asset.name,
            price,
            changePct: ((price - prev) / prev) * 100,
          }
        }),
      )
      return quotes
    },
  }
}

export const indicesSources: Source<AssetQuote[]>[] = [
  yahooSource('query1.finance.yahoo.com'),
  yahooSource('query2.finance.yahoo.com'),
]

// ---------------------------------------------------------------------------
// Fear & Greed index — Alternative.me
// ---------------------------------------------------------------------------

type FngResponse = {
  data?: { value?: string; value_classification?: string; timestamp?: string }[]
}

export const sentimentSources: Source<SentimentData>[] = [
  {
    name: 'alternative.me',
    async fetch(signal) {
      const res = await fetch('https://api.alternative.me/fng/?limit=1', {
        signal,
        cache: 'no-store',
      })
      assertUpstreamOk(res, 'alternative.me')
      const json = (await res.json()) as FngResponse
      const item = json.data?.[0]
      const value = Number(item?.value)
      if (!item || Number.isNaN(value)) throw new Error('alternative.me missing data')
      return {
        value,
        classification: item.value_classification ?? 'Neutral',
        timestamp: Number(item.timestamp) * 1000 || Date.now(),
      }
    },
  },
]
