import 'server-only'

import { fetchJson, type Source } from './resilient'

// Whole-market aggregates used by the Market Score: total market cap change,
// BTC dominance, total volume. CoinGecko primary, CoinPaprika fallback —
// both keyless and reachable from US datacenters (see sources.ts).

export type GlobalData = {
  marketCapUsd: number
  marketCapChange24hPct: number
  volume24hUsd: number
  btcDominancePct: number
}

type CoinGeckoGlobal = {
  data?: {
    total_market_cap?: { usd?: number }
    total_volume?: { usd?: number }
    market_cap_percentage?: { btc?: number }
    market_cap_change_percentage_24h_usd?: number
  }
}

type CoinPaprikaGlobal = {
  market_cap_usd?: number
  volume_24h_usd?: number
  bitcoin_dominance_percentage?: number
  market_cap_change_24h?: number
}

export const globalSources: Source<GlobalData>[] = [
  {
    name: 'coingecko-global',
    async fetch(signal) {
      const json = await fetchJson<CoinGeckoGlobal>(
        'https://api.coingecko.com/api/v3/global',
        signal,
        'coingecko-global'
      )
      const d = json.data
      if (
        typeof d?.total_market_cap?.usd !== 'number' ||
        typeof d.market_cap_change_percentage_24h_usd !== 'number'
      ) {
        throw new Error('coingecko-global missing fields')
      }
      return {
        marketCapUsd: d.total_market_cap.usd,
        marketCapChange24hPct: d.market_cap_change_percentage_24h_usd,
        volume24hUsd: d.total_volume?.usd ?? 0,
        btcDominancePct: d.market_cap_percentage?.btc ?? 0,
      }
    },
  },
  {
    name: 'coinpaprika-global',
    async fetch(signal) {
      const json = await fetchJson<CoinPaprikaGlobal>(
        'https://api.coinpaprika.com/v1/global',
        signal,
        'coinpaprika-global'
      )
      if (
        typeof json.market_cap_usd !== 'number' ||
        typeof json.market_cap_change_24h !== 'number'
      ) {
        throw new Error('coinpaprika-global missing fields')
      }
      return {
        marketCapUsd: json.market_cap_usd,
        marketCapChange24hPct: json.market_cap_change_24h,
        volume24hUsd: json.volume_24h_usd ?? 0,
        btcDominancePct: json.bitcoin_dominance_percentage ?? 0,
      }
    },
  },
]
