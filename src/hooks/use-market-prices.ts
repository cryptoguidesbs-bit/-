'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { BINANCE_WS_URL, marketSymbols } from '@/config/market'

export type MarketPrice = {
  symbol: string
  price: number
  changePct: number
  volumeQuote: number
}

export type MarketStatus = 'connecting' | 'live' | 'offline'

type MiniTicker = {
  e: string
  s: string
  c: string
  o: string
  q: string
}

// Live prices: REST snapshot for first paint (+30s polling as fallback),
// then Binance miniTicker WebSocket pushes real-time updates on top.
export function useMarketPrices() {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({})
  const [status, setStatus] = useState<MarketStatus>('connecting')

  const { data: snapshot } = useQuery({
    queryKey: ['market-tickers'],
    queryFn: async () => {
      const res = await fetch('/api/market/tickers')
      if (!res.ok) throw new Error('Ticker snapshot failed')
      return (await res.json()) as { tickers: MarketPrice[] }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  // Snapshot only fills gaps — WebSocket data is fresher and wins.
  useEffect(() => {
    if (!snapshot?.tickers.length) return
    setPrices((prev) => {
      const next = { ...prev }
      for (const t of snapshot.tickers) {
        if (!next[t.symbol]) next[t.symbol] = t
      }
      return next
    })
  }, [snapshot])

  useEffect(() => {
    let ws: WebSocket | null = null
    let unmounted = false
    let retries = 0
    let timer: number | undefined

    const streams = marketSymbols.map((m) => `${m.symbol.toLowerCase()}@miniTicker`).join('/')

    const connect = () => {
      try {
        ws = new WebSocket(`${BINANCE_WS_URL}?streams=${streams}`)
      } catch {
        setStatus('offline')
        return
      }

      ws.onopen = () => {
        retries = 0
        setStatus('live')
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { data?: MiniTicker }
          const d = msg.data
          if (d?.e !== '24hrMiniTicker') return
          const open = Number(d.o)
          const close = Number(d.c)
          setPrices((prev) => ({
            ...prev,
            [d.s]: {
              symbol: d.s,
              price: close,
              changePct: open > 0 ? ((close - open) / open) * 100 : 0,
              volumeQuote: Number(d.q),
            },
          }))
        } catch {
          // Ignore malformed frames.
        }
      }

      ws.onclose = () => {
        if (unmounted) return
        setStatus('offline')
        const delay = Math.min(30_000, 1_000 * 2 ** retries)
        retries += 1
        timer = window.setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()

    return () => {
      unmounted = true
      if (timer) window.clearTimeout(timer)
      ws?.close()
    }
  }, [])

  return { prices, status }
}
