import { NextResponse } from 'next/server'

import { parseRss } from '@/lib/news/rss'

export const revalidate = 120

export type NewsItem = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: number | null
  sample?: boolean
}

// Public RSS feeds that work without an API key, tried in order.
const FEEDS = [
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
]

// Shown when every upstream feed is unreachable, flagged so the UI can label
// them as sample data.
const FALLBACK_NEWS: NewsItem[] = [
  {
    id: 'sample-1',
    title: 'Bitcoin trades in a narrow range as markets await macro data',
    source: 'Sample Feed',
    url: '#',
    publishedAt: null,
    sample: true,
  },
  {
    id: 'sample-2',
    title: 'Ethereum ecosystem update: layer-2 activity continues to grow',
    source: 'Sample Feed',
    url: '#',
    publishedAt: null,
    sample: true,
  },
  {
    id: 'sample-3',
    title: 'Stablecoin settlement volume draws regulatory attention',
    source: 'Sample Feed',
    url: '#',
    publishedAt: null,
    sample: true,
  },
  {
    id: 'sample-4',
    title: 'Exchange reserves shift as on-chain activity picks up',
    source: 'Sample Feed',
    url: '#',
    publishedAt: null,
    sample: true,
  },
]

// Live headline proxy for the home page — same parser as the ingestion
// pipeline (lib/news/rss), just a different shape for the client.
export async function GET() {
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { next: { revalidate: 120 } })
      if (!res.ok) continue
      const items: NewsItem[] = parseRss(await res.text())
        .slice(0, 8)
        .map((item, index) => ({
          id: `${feed.source}-${index}`,
          title: item.title,
          source: feed.source,
          url: item.url,
          publishedAt: item.publishedAt ? item.publishedAt.getTime() : null,
        }))
      if (items.length > 0) {
        return NextResponse.json({ items, live: true })
      }
    } catch {
      // Try the next feed.
    }
  }
  return NextResponse.json({ items: FALLBACK_NEWS, live: false })
}
