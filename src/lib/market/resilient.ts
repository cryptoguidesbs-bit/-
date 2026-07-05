import 'server-only'

// Resilient multi-source fetcher for market data.
//
// Strategy per request:
//   1. Serve the in-memory cache while it is fresh (freshMs).
//   2. Otherwise walk the sources in order; each attempt gets a hard timeout
//      and `retries` extra tries with a small backoff.
//   3. A 429 puts that source on cooldown so we stop hammering it.
//   4. If every source fails, fall back to the LAST GOOD VALUE (stale: true).
//   5. Only when there has never been a good value does the caller get
//      data: null — still a 200 envelope, never a crash.

export type MarketResult<T> = {
  data: T | null
  stale: boolean
  updatedAt: string | null
  source: string | null
  error?: string
}

export type Source<T> = {
  name: string
  fetch: (signal: AbortSignal) => Promise<T>
}

type CacheEntry = { data: unknown; updatedAt: number; source: string }

// Kept on globalThis (same pattern as the Prisma client) so the last-good
// cache survives dev-mode module re-instantiation and is shared across all
// route bundles in one server process.
const globalStore = globalThis as unknown as {
  __marketLastGood?: Map<string, CacheEntry>
  __marketCooldown?: Map<string, number>
}
const lastGood = (globalStore.__marketLastGood ??= new Map<string, CacheEntry>())
const cooldownUntil = (globalStore.__marketCooldown ??= new Map<string, number>())

export class RateLimitError extends Error {
  constructor(source: string) {
    super(`rate limited by ${source}`)
  }
}

const RATE_LIMIT_COOLDOWN_MS = 60_000

function toResult<T>(entry: CacheEntry, stale: boolean): MarketResult<T> {
  return {
    data: entry.data as T,
    stale,
    updatedAt: new Date(entry.updatedAt).toISOString(),
    source: entry.source,
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function resilientFetch<T>(
  cacheKey: string,
  sources: Source<T>[],
  opts: {
    timeoutMs?: number
    retries?: number
    freshMs?: number
    /** Test hook: skip all upstream calls, as if the network were down. */
    blocked?: boolean
  } = {},
): Promise<MarketResult<T>> {
  const { timeoutMs = 5_000, retries = 1, freshMs = 30_000, blocked = false } = opts

  const cached = lastGood.get(cacheKey)
  if (cached && Date.now() - cached.updatedAt < freshMs) {
    return toResult<T>(cached, false)
  }

  if (!blocked) {
    for (const source of sources) {
      const cooldown = cooldownUntil.get(source.name)
      if (cooldown && Date.now() < cooldown) continue

      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const data = await source.fetch(controller.signal)
          const entry: CacheEntry = { data, updatedAt: Date.now(), source: source.name }
          lastGood.set(cacheKey, entry)
          return toResult<T>(entry, false)
        } catch (error) {
          if (error instanceof RateLimitError) {
            cooldownUntil.set(source.name, Date.now() + RATE_LIMIT_COOLDOWN_MS)
            break // no point retrying a rate-limited source
          }
          if (attempt < retries) await sleep(250 * (attempt + 1))
        } finally {
          clearTimeout(timer)
        }
      }
    }
  }

  // Everything failed (or upstream blocked) → last good value, marked stale.
  if (cached) return toResult<T>(cached, true)

  return { data: null, stale: true, updatedAt: null, source: null, error: 'unavailable' }
}

/** Throw the right error type for an upstream response. */
export function assertUpstreamOk(res: Response, sourceName: string): void {
  if (res.status === 429) throw new RateLimitError(sourceName)
  if (!res.ok) throw new Error(`${sourceName} responded ${res.status}`)
}
