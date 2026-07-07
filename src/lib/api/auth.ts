import 'server-only'

import type { NextRequest } from 'next/server'
import type { ApiKey } from '@prisma/client'

import { isFeatureAllowedInCountry, planHasFeature } from '@/config/features'
import type { SubscriptionPlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashApiKey } from './keys'
import { checkRateLimit, defaultRateLimit, type RateLimitResult } from './rate-limit'

// ---------------------------------------------------------------------------
// Public API (v1) authentication: Bearer/x-api-key key → hash lookup →
// revocation → plan re-check (api.center = Legendary) → region policy →
// per-key rate limit → usage aggregation. Every deny path returns the
// status + error the route should respond with.
// ---------------------------------------------------------------------------

const ENTITLED_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE']

export type ApiAuthResult =
  | { ok: true; apiKey: ApiKey; rate: RateLimitResult }
  | { ok: false; status: number; error: string; rate?: RateLimitResult }

function extractKey(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return request.headers.get('x-api-key')
}

export async function authenticateApiKey(
  request: NextRequest,
  endpoint: string,
): Promise<ApiAuthResult> {
  const rawKey = extractKey(request)
  if (!rawKey) return { ok: false, status: 401, error: 'missing api key' }

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(rawKey) },
    include: { user: { select: { role: true, subscription: { select: { plan: true, status: true } } } } },
  })
  if (!apiKey) return { ok: false, status: 401, error: 'invalid api key' }
  if (apiKey.revokedAt) return { ok: false, status: 401, error: 'api key revoked' }

  // Plan re-check at call time — a lapsed Legendary subscription cuts access.
  const sub = apiKey.user.subscription
  const plan: SubscriptionPlan =
    apiKey.user.role === 'ADMIN'
      ? 'LEGENDARY'
      : sub && ENTITLED_STATUSES.includes(sub.status)
        ? sub.plan
        : 'FREE'
  if (!planHasFeature(plan, 'api.center')) {
    return { ok: false, status: 403, error: 'api access requires the Legendary plan' }
  }

  // Region policy (api.center whitelist) — absolute, applies to ADMIN too.
  const country =
    request.headers.get('x-vercel-ip-country')?.toUpperCase() ??
    request.headers.get('cf-ipcountry')?.toUpperCase() ??
    null
  if (!isFeatureAllowedInCountry('api.center', country)) {
    return { ok: false, status: 403, error: 'api access is not available in your region' }
  }

  // Per-key rate limit (stage 21 tie-in). Non-production test override.
  const testLimit =
    process.env.NODE_ENV !== 'production'
      ? Number(request.headers.get('x-test-rate-limit'))
      : NaN
  const limit = Number.isFinite(testLimit) && testLimit > 0 ? testLimit : defaultRateLimit()
  const rate = checkRateLimit(apiKey.id, limit)
  if (!rate.allowed) {
    return { ok: false, status: 429, error: 'rate limit exceeded', rate }
  }

  // Usage aggregation (per key × endpoint × UTC day).
  const day = new Date().toISOString().slice(0, 10)
  await Promise.all([
    prisma.apiUsage.upsert({
      where: { apiKeyId_endpoint_day: { apiKeyId: apiKey.id, endpoint, day } },
      update: { count: { increment: 1 } },
      create: { apiKeyId: apiKey.id, endpoint, day, count: 1 },
    }),
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }),
  ])

  return { ok: true, apiKey, rate }
}

export function rateHeaders(rate?: RateLimitResult): Record<string, string> {
  if (!rate) return {}
  return {
    'X-RateLimit-Limit': String(rate.limit),
    'X-RateLimit-Remaining': String(rate.remaining),
    'Retry-After': String(rate.retryAfter),
  }
}
