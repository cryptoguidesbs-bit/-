import type { SubscriptionPlan } from '@prisma/client'

// ---------------------------------------------------------------------------
// Per-plan numeric limits — the single source of truth for BOTH the pricing
// page copy ("alerts: 20") and server enforcement (409 / 429 on overflow).
// Client-safe on purpose (no server-only import) so the cards can render the
// same numbers the API enforces; they stay in sync by construction.
//
// `null` = unlimited. `0` = not included — the feature gate
// (FEATURE_MIN_PLAN) already blocks it; the 0 keeps this table honest for
// copy that reads it. Plans, prices and feature gates are unchanged: alerts
// and portfolio stay Trader+, the public API stays Whale-only.
// ---------------------------------------------------------------------------

export type LimitKey =
  | 'watchlistItems'
  | 'alertRules'
  | 'portfolioHoldings'
  | 'apiKeys'
  | 'webhooks'
  | 'apiRequestsPerMinute'
  | 'apiCallsPerMonth'

export type PlanLimits = Record<LimitKey, number | null>

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  FREE: {
    watchlistItems: 10,
    alertRules: 0,
    portfolioHoldings: 0,
    apiKeys: 0,
    webhooks: 0,
    apiRequestsPerMinute: 0,
    apiCallsPerMonth: 0,
  },
  STARTER: {
    watchlistItems: 25,
    alertRules: 0,
    portfolioHoldings: 0,
    apiKeys: 0,
    webhooks: 0,
    apiRequestsPerMinute: 0,
    apiCallsPerMonth: 0,
  },
  TRADER: {
    watchlistItems: 50,
    alertRules: 20,
    portfolioHoldings: 50,
    apiKeys: 0,
    webhooks: 0,
    apiRequestsPerMinute: 0,
    apiCallsPerMonth: 0,
  },
  PRO: {
    watchlistItems: 100,
    alertRules: 50,
    portfolioHoldings: 200,
    apiKeys: 0,
    webhooks: 0,
    apiRequestsPerMinute: 0,
    apiCallsPerMonth: 0,
  },
  WHALE: {
    watchlistItems: null,
    alertRules: 100,
    portfolioHoldings: null,
    apiKeys: 5,
    webhooks: 5,
    apiRequestsPerMinute: 60,
    apiCallsPerMonth: 100_000,
  },
}

export function planLimit(plan: SubscriptionPlan, key: LimitKey): number | null {
  return PLAN_LIMITS[plan][key]
}

/** Pure check — shared by server routes and (for display) the UI. */
export function isWithinLimit(plan: SubscriptionPlan, key: LimitKey, used: number): boolean {
  const limit = planLimit(plan, key)
  return limit === null || used < limit
}
