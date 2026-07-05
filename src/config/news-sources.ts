import type { NewsRegion } from '@prisma/client'

// Region-balanced RSS sources (US / Europe / Asia). Ingestion tolerates
// individual source failures and caps items per source per run so no single
// feed dominates the stream.
export type NewsSource = {
  name: string
  url: string
  region: NewsRegion
}

export const newsSources: NewsSource[] = [
  // US
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', region: 'US' },
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', region: 'US' },
  // Europe
  { name: 'BeInCrypto', url: 'https://beincrypto.com/feed/', region: 'EUROPE' },
  { name: 'CryptoNews', url: 'https://cryptonews.com/news/feed/', region: 'EUROPE' },
  // Asia
  { name: 'AMBCrypto', url: 'https://ambcrypto.com/feed/', region: 'ASIA' },
  { name: 'TokenPost', url: 'https://www.tokenpost.kr/rss', region: 'ASIA' },
]

export const MAX_ITEMS_PER_SOURCE = 8
