import 'server-only'

import { EXCHANGE_WALLETS } from '@/config/exchange-wallets'
import { assertUpstreamOk, type Source } from '@/lib/market/resilient'

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type WhaleTx = {
  hash: string
  time: string
  valueBtc: number
  valueUsd: number
  exchange: string | null
  direction: 'inflow' | 'outflow' | null
}

export type ExchangeFlow = {
  inflowUsd: number
  outflowUsd: number
  netUsd: number
  sampleSize: number
  matchedCount: number
  method: 'mempool-sample'
}

export type WhaleData = { txs: WhaleTx[]; flow: ExchangeFlow | null }

export type SeriesMetric = {
  latest: number
  changePct: number | null
  series: { t: number; v: number }[]
}

export type NetworkData = {
  activeAddresses: SeriesMetric
  transactions: SeriesMetric
  hashRate: SeriesMetric
  minerRevenue: SeriesMetric
}

export type StablecoinData = {
  symbol: string
  name: string
  marketCap: number
  changePct24h: number | null
}[]

// ---------------------------------------------------------------------------
// Whale tracker — Blockchair large transactions (primary), with the mempool
// sample from blockchain.info supplying the exchange-flow estimate.
// ---------------------------------------------------------------------------

const WHALE_MIN_USD = 5_000_000

type BlockchairTx = {
  hash: string
  time: string
  output_total: number
  output_total_usd: number
}

type MempoolTx = {
  hash: string
  time: number
  inputs: { prev_out?: { addr?: string; value?: number } }[]
  out: { addr?: string; value?: number }[]
}

async function fetchMempool(
  signal: AbortSignal,
): Promise<{ flow: ExchangeFlow; whaleTxs: WhaleTx[] }> {
  const res = await fetch('https://blockchain.info/unconfirmed-transactions?format=json&cors=true', {
    signal,
    cache: 'no-store',
  })
  assertUpstreamOk(res, 'blockchain.info-mempool')
  const json = (await res.json()) as { txs?: MempoolTx[] }
  const txs = json.txs ?? []

  // Flow is measured in BTC here; the route converts to USD via the live
  // BTC quote (valueUsd 0 marks "needs conversion").
  let inflowSat = 0
  let outflowSat = 0
  let matchedCount = 0
  for (const tx of txs) {
    let matched = false
    for (const output of tx.out ?? []) {
      if (output.addr && EXCHANGE_WALLETS[output.addr]) {
        inflowSat += output.value ?? 0
        matched = true
      }
    }
    for (const input of tx.inputs ?? []) {
      const addr = input.prev_out?.addr
      if (addr && EXCHANGE_WALLETS[addr]) {
        outflowSat += input.prev_out?.value ?? 0
        matched = true
      }
    }
    if (matched) matchedCount += 1
  }

  // Largest transactions currently in the mempool sample (fallback whale
  // feed when Blockchair is unavailable).
  const whaleTxs: WhaleTx[] = txs
    .map((tx) => ({
      hash: tx.hash,
      time: new Date(tx.time * 1000).toISOString(),
      valueBtc: (tx.out ?? []).reduce((sum, o) => sum + (o.value ?? 0), 0) / 1e8,
      valueUsd: 0, // converted by the route
      exchange: null,
      direction: null,
    }))
    .sort((a, b) => b.valueBtc - a.valueBtc)
    .slice(0, 15)

  return {
    flow: {
      inflowUsd: inflowSat / 1e8,
      outflowUsd: outflowSat / 1e8,
      netUsd: (inflowSat - outflowSat) / 1e8,
      sampleSize: txs.length,
      matchedCount,
      method: 'mempool-sample',
    },
    whaleTxs,
  }
}

export const whaleSources: Source<WhaleData>[] = [
  {
    name: 'blockchair+mempool',
    async fetch(signal) {
      const [txRes, mempool] = await Promise.all([
        (async () => {
          const res = await fetch(
            `https://api.blockchair.com/bitcoin/transactions?q=output_total_usd(${WHALE_MIN_USD}..)&s=time(desc)&limit=15`,
            { signal, cache: 'no-store' },
          )
          assertUpstreamOk(res, 'blockchair')
          const json = (await res.json()) as { data?: BlockchairTx[] | null }
          if (!Array.isArray(json.data)) throw new Error('blockchair rejected the request')
          return json
        })(),
        fetchMempool(signal).catch(() => null),
      ])

      const txs: WhaleTx[] = (txRes.data ?? []).map((tx) => ({
        hash: tx.hash,
        time: tx.time,
        valueBtc: tx.output_total / 1e8,
        valueUsd: tx.output_total_usd,
        exchange: null,
        direction: null,
      }))
      if (txs.length === 0) throw new Error('blockchair returned no whale txs')
      return { txs, flow: mempool?.flow ?? null }
    },
  },
  {
    // Fallback: whale feed + flow both from the blockchain.info mempool
    // sample (largest pending transactions).
    name: 'blockchain.info-mempool',
    async fetch(signal) {
      const mempool = await fetchMempool(signal)
      if (mempool.whaleTxs.length === 0) throw new Error('mempool sample empty')
      return { txs: mempool.whaleTxs, flow: mempool.flow }
    },
  },
]

// ---------------------------------------------------------------------------
// Network activity — blockchain.info charts API (BTC)
// ---------------------------------------------------------------------------

type ChartResponse = { values?: { x: number; y: number }[] }

async function fetchChart(name: string, signal: AbortSignal): Promise<SeriesMetric> {
  const res = await fetch(
    `https://api.blockchain.info/charts/${name}?timespan=30days&format=json&cors=true`,
    { signal, cache: 'no-store' },
  )
  assertUpstreamOk(res, `blockchain.info-${name}`)
  const json = (await res.json()) as ChartResponse
  const values = (json.values ?? []).map((v) => ({ t: v.x * 1000, v: v.y }))
  if (values.length < 2) throw new Error(`${name}: not enough datapoints`)
  const latest = values[values.length - 1].v
  const previous = values[values.length - 2].v
  return {
    latest,
    changePct: previous > 0 ? ((latest - previous) / previous) * 100 : null,
    series: values,
  }
}

export const networkSources: Source<NetworkData>[] = [
  {
    name: 'blockchain.info-charts',
    async fetch(signal) {
      const [activeAddresses, transactions, hashRate, minerRevenue] = await Promise.all([
        fetchChart('n-unique-addresses', signal),
        fetchChart('n-transactions', signal),
        fetchChart('hash-rate', signal),
        fetchChart('miners-revenue', signal),
      ])
      return { activeAddresses, transactions, hashRate, minerRevenue }
    },
  },
]

// ---------------------------------------------------------------------------
// Stablecoin supply — CoinGecko market caps
// ---------------------------------------------------------------------------

type GeckoMarket = {
  symbol: string
  name: string
  market_cap: number
  market_cap_change_percentage_24h: number | null
}

export const stablecoinSources: Source<StablecoinData>[] = [
  {
    name: 'coingecko',
    async fetch(signal) {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=tether,usd-coin,dai',
        { signal, cache: 'no-store' },
      )
      assertUpstreamOk(res, 'coingecko')
      const json = (await res.json()) as GeckoMarket[]
      if (!Array.isArray(json) || json.length === 0) throw new Error('coingecko empty')
      return json.map((coin) => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        marketCap: coin.market_cap,
        changePct24h: coin.market_cap_change_percentage_24h,
      }))
    },
  },
]
