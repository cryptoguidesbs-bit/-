import 'server-only'

// Fixed-window per-key rate limiter. In-process state survives dev module
// reloads via globalThis (same pattern as the market last-good cache).
// NOTE (stage 21 tie-in): for multi-instance production this moves to a
// shared store (Redis/Upstash) — the call shape below stays the same.

type Window = { windowStart: number; count: number }

const store =
  ((globalThis as Record<string, unknown>).__apiRateLimit as Map<string, Window>) ??
  new Map<string, Window>()
;(globalThis as Record<string, unknown>).__apiRateLimit = store

const WINDOW_MS = 60_000

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  /** Seconds until the window resets. */
  retryAfter: number
}

export function defaultRateLimit(): number {
  const fromEnv = Number(process.env.API_RATE_LIMIT_PER_MIN)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 60
}

export function checkRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now()
  const current = store.get(key)

  if (!current || now - current.windowStart >= WINDOW_MS) {
    store.set(key, { windowStart: now, count: 1 })
    return { allowed: true, limit, remaining: limit - 1, retryAfter: 60 }
  }

  current.count += 1
  const remaining = Math.max(0, limit - current.count)
  const retryAfter = Math.ceil((current.windowStart + WINDOW_MS - now) / 1000)
  return { allowed: current.count <= limit, limit, remaining, retryAfter }
}
