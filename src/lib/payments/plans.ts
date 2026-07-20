// Paid subscription plans (USD). "free" is not a payable plan and is
// intentionally excluded here — it has no Stripe product/price.
export const paidPlans = ['starter', 'trader', 'pro', 'whale'] as const
export type PaidPlanKey = (typeof paidPlans)[number]

export type BillingInterval = 'monthly' | 'yearly'

// Amounts in whole USD. Yearly = 10× monthly (two months free, ~17% off).
export const planAmounts: Record<PaidPlanKey, Record<BillingInterval, number>> = {
  starter: { monthly: 59, yearly: 590 },
  trader: { monthly: 149, yearly: 1490 },
  pro: { monthly: 499, yearly: 4990 },
  whale: { monthly: 1499, yearly: 14990 },
}

export const planLabels: Record<PaidPlanKey, string> = {
  starter: 'Starter',
  trader: 'Trader',
  pro: 'Pro',
  whale: 'Whale',
}

// Env var that holds the Stripe price ID for each plan/interval. Populated by
// `npm run stripe:seed`.
export const priceEnvVar: Record<PaidPlanKey, Record<BillingInterval, string>> = {
  starter: {
    monthly: 'STRIPE_PRICE_STARTER_MONTHLY',
    yearly: 'STRIPE_PRICE_STARTER_YEARLY',
  },
  trader: {
    monthly: 'STRIPE_PRICE_TRADER_MONTHLY',
    yearly: 'STRIPE_PRICE_TRADER_YEARLY',
  },
  pro: {
    monthly: 'STRIPE_PRICE_PRO_MONTHLY',
    yearly: 'STRIPE_PRICE_PRO_YEARLY',
  },
  whale: {
    monthly: 'STRIPE_PRICE_WHALE_MONTHLY',
    yearly: 'STRIPE_PRICE_WHALE_YEARLY',
  },
}

export function isPaidPlan(value: string): value is PaidPlanKey {
  return (paidPlans as readonly string[]).includes(value)
}

// Rank for upgrade/downgrade comparison. free < starter < … < whale.
export const planKeyRank: Record<'free' | PaidPlanKey, number> = {
  free: 0,
  starter: 1,
  trader: 2,
  pro: 3,
  whale: 4,
}

// Yearly = 10× monthly → 2 months free (~17% off). Single source of truth.
export const YEARLY_FREE_MONTHS = 2
export const YEARLY_DISCOUNT_PCT = Math.round((YEARLY_FREE_MONTHS / 12) * 100) // 17
export const TRIAL_PERIOD_DAYS = 7
export const ANNUAL_REFUND_WINDOW_DAYS = 14

/**
 * Compare a target plan/interval against the current one.
 *   'upgrade'   → higher plan, or same plan monthly→yearly (charge more now)
 *   'downgrade' → lower plan, or same plan yearly→monthly (defer to period end)
 *   'same'      → identical plan+interval
 */
export function changeDirection(
  current: { plan: PaidPlanKey; interval: BillingInterval },
  target: { plan: PaidPlanKey; interval: BillingInterval },
): 'upgrade' | 'downgrade' | 'same' {
  if (current.plan === target.plan && current.interval === target.interval) return 'same'
  if (planKeyRank[target.plan] > planKeyRank[current.plan]) return 'upgrade'
  if (planKeyRank[target.plan] < planKeyRank[current.plan]) return 'downgrade'
  // Same plan, different interval: monthly→yearly is an upgrade (bills the
  // larger amount now), yearly→monthly is a downgrade (defer to period end).
  return target.interval === 'yearly' ? 'upgrade' : 'downgrade'
}
