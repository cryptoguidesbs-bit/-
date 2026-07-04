import { NextResponse } from 'next/server'

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

function extractTag(chunk: string, tag: string): string {
  const match = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  if (!match) return ''
  return match[1].replace('<![CDATA[', '').replace(']]>', '').trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
}

function parseRss(xml: string, source: string): NewsItem[] {
  return xml
    .split('<item>')
    .slice(1)
    .map((chunk, index) => {
      const title = decodeEntities(extractTag(chunk, 'title'))
      const url = extractTag(chunk, 'link') || extractTag(chunk, 'guid')
      const pubDate = extractTag(chunk, 'pubDate')
      const timestamp = pubDate ? Date.parse(pubDate) : NaN
      return {
        id: `${source}-${index}`,
        title,
        source,
        url,
        publishedAt: Number.isNaN(timestamp) ? null : timestamp,
      }
    })
    .filter((item) => item.title && item.url.startsWith('http'))
}

export async function GET() {
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { next: { revalidate: 120 } })
      if (!res.ok) continue
      const items = parseRss(await res.text(), feed.source).slice(0, 8)
      if (items.length > 0) {
        return NextResponse.json({ items, live: true })
      }
    } catch {
      // Try the next feed.
    }
  }
  return NextResponse.json({ items: FALLBACK_NEWS, live: false })
}
