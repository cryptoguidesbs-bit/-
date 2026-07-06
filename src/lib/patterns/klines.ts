import 'server-only'

import { assertUpstreamOk, type Source } from '@/lib/market/resilient'
import type { Candle } from './detect'

// Binance klines (OHLC) with a mirror-host fallback.

export const PATTERN_SYMBOLS = ['BTC', 'ETH', 'SOL'] as const
export const PATTERN_INTERVALS = ['1h', '4h', '1d'] as const

export type PatternSymbol = (typeof PATTERN_SYMBOLS)[number]
export type PatternInterval = (typeof PATTERN_INTERVALS)[number]

type RawKline = [number, string, string, string, string, ...unknown[]]

function klineSource(host: string, symbol: string, interval: string): Source<Candle[]> {
  return {
    name: host,
    async fetch(signal) {
      const res = await fetch(
        `https://${host}/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=200`,
        { signal, cache: 'no-store' },
      )
      assertUpstreamOk(res, host)
      const rows = (await res.json()) as RawKline[]
      if (!Array.isArray(rows) || rows.length < 20) throw new Error(`${host}: not enough klines`)
      return rows.map((row) => ({
        t: row[0],
        o: Number(row[1]),
        h: Number(row[2]),
        l: Number(row[3]),
        c: Number(row[4]),
      }))
    },
  }
}

export function klineSources(symbol: PatternSymbol, interval: PatternInterval): Source<Candle[]>[] {
  return [
    klineSource('api.binance.com', symbol, interval),
    klineSource('api1.binance.com', symbol, interval),
  ]
}
