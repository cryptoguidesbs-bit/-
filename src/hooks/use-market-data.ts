'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { MarketResult } from '@/lib/market/resilient'
import type { MarketScore } from '@/lib/market/score'
import type { ScreenerRow } from '@/lib/market/screener-sources'
import type { AssetQuote, SentimentData } from '@/lib/market/sources'

// Client-side caching layer (React Query) on top of the resilient server
// routes. placeholderData keeps the last screen while refetching, so the UI
// never flashes empty even when an upstream API is down.

async function getJson<T>(url: string): Promise<MarketResult<T>> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return (await res.json()) as MarketResult<T>
}

export function useCryptoPrices() {
  return useQuery({
    queryKey: ['market', 'crypto-prices'],
    queryFn: () => getJson<AssetQuote[]>('/api/market/prices'),
    refetchInterval: 30_000,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    retry: 2,
  })
}

export function useIndices() {
  return useQuery({
    queryKey: ['market', 'indices'],
    queryFn: () => getJson<AssetQuote[]>('/api/market/indices'),
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 2,
  })
}

export function useSentiment() {
  return useQuery({
    queryKey: ['market', 'sentiment'],
    queryFn: () => getJson<SentimentData>('/api/market/sentiment'),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
  })
}

// Market Score is not a MarketResult envelope — it carries its own
// partial/missing/stale fields per input.
export function useMarketScore() {
  return useQuery({
    queryKey: ['market', 'score'],
    queryFn: async () => {
      const res = await fetch('/api/market/score')
      if (!res.ok) throw new Error(`/api/market/score → ${res.status}`)
      return (await res.json()) as MarketScore
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 2,
  })
}

export function useScreener() {
  return useQuery({
    queryKey: ['market', 'screener'],
    queryFn: () => getJson<ScreenerRow[]>('/api/market/screener'),
    refetchInterval: 2 * 60_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
  })
}
