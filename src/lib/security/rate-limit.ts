import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'

import { checkRateLimit } from '@/lib/api/rate-limit'
import { clientIp } from './request'

// ---------------------------------------------------------------------------
// Sliding-window rate limiting for sensitive, cookie-authenticated mutations
// (consent, checkout, account deletion, data export, admin broadcast). Keyed
// by identity when available, otherwise by client IP.
//
// Shares the in-process fixed-window store with the public API limiter
// (src/lib/api/rate-limit.ts). For multi-instance production this store
// moves to Redis/Upstash — the call shape stays the same (see
// docs/security-checklist.md).
// ---------------------------------------------------------------------------

export type RateLimitOptions = {
  /** Bucket name, e.g. 'consent' or 'account-delete'. */
  name: string
  /** Max requests per minute for this bucket. */
  limit: number
  /** Stable identity (e.g. user id). Falls back to IP when absent. */
  identifier?: string | null
  /** Test hook (non-production): override the limit via a request header. */
  request?: NextRequest
}

/**
 * Enforce a rate limit. Returns a 429 NextResponse when exceeded (attach it
 * and return early), or null when the request may proceed.
 */
export function enforceRateLimit(options: RateLimitOptions): NextResponse | null {
  const ip = options.request ? clientIp(options.request) : null
  const identity = options.identifier ?? ip ?? 'anon'

  let limit = options.limit
  if (process.env.NODE_ENV !== 'production' && options.request) {
    const override = Number(options.request.headers.get('x-test-rate-limit'))
    if (Number.isFinite(override) && override > 0) limit = override
  }

  const result = checkRateLimit(`${options.name}:${identity}`, limit)
  if (result.allowed) return null

  return NextResponse.json(
    { error: 'rate limit exceeded' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  )
}
