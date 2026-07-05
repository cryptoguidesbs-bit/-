// Dependency-free RSS parsing (title / link / pubDate), tolerant of CDATA.

export type RssItem = {
  title: string
  url: string
  publishedAt: Date | null
}

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

export function parseRss(xml: string): RssItem[] {
  return xml
    .split('<item>')
    .slice(1)
    .map((chunk) => {
      const title = decodeEntities(extractTag(chunk, 'title'))
      const url = extractTag(chunk, 'link') || extractTag(chunk, 'guid')
      const pubDate = extractTag(chunk, 'pubDate')
      const timestamp = pubDate ? Date.parse(pubDate) : NaN
      return {
        title,
        url,
        publishedAt: Number.isNaN(timestamp) ? null : new Date(timestamp),
      }
    })
    .filter((item) => item.title.length > 0 && item.url.startsWith('http'))
}

export async function fetchRss(url: string, timeoutMs = 8_000): Promise<RssItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; CryptoGuide/1.0)' },
    })
    if (!res.ok) throw new Error(`${url} responded ${res.status}`)
    return parseRss(await res.text())
  } finally {
    clearTimeout(timer)
  }
}
