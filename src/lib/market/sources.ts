import 'server-only'

import { BINANCE_REST_URL } from '@/config/market'
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
// Crypto prices — CryptoCompare primary, Binance fallback
// ---------------------------------------------------------------------------

type CryptoCompareFull = {
  RAW?: Record<string, { USD?: { PRICE?: number; CHANGEPCT24HOUR?: number } }>
}

export const cryptoSources: Source<AssetQuote[]>[] = [
  {
    name: 'cryptocompare',
    async fetch(signal) {
      const fsyms = cryptoAssets.map((a) => a.id).join(',')
      const res = await fetch(
        `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsyms}&tsyms=USD`,
        { signal, cache: 'no-store' },
      )
      assertUpstreamOk(res, 'cryptocompare')
      const json = (await res.json()) as CryptoCompareFull
      const quotes = cryptoAssets.map((asset) => {
        const raw = json.RAW?.[asset.id]?.USD
        if (typeof raw?.PRICE !== 'number') throw new Error(`cryptocompare missing ${asset.id}`)
        return {
          id: asset.id,
          name: asset.name,
          price: raw.PRICE,
          changePct: raw.CHANGEPCT24HOUR ?? 0,
        }
      })
      return quotes
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
