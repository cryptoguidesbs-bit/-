// Paid subscription plans (A-3 matrix, USD). "free" is not a payable plan and
// is intentionally excluded here — it has no Stripe product/price.
export const paidPlans = ['standard', 'professional', 'institutional', 'legendary'] as const
export type PaidPlanKey = (typeof paidPlans)[number]

export type BillingInterval = 'monthly' | 'yearly'

// Amounts in whole USD. Yearly = 10× monthly (two months free).
export const planAmounts: Record<PaidPlanKey, Record<BillingInterval, number>> = {
  standard: { monthly: 199, yearly: 1990 },
  professional: { monthly: 499, yearly: 4990 },
  institutional: { monthly: 1499, yearly: 14990 },
  legendary: { monthly: 4999, yearly: 49990 },
}

export const planLabels: Record<PaidPlanKey, string> = {
  standard: 'Standard',
  professional: 'Professional',
  institutional: 'Institutional',
  legendary: 'Legendary',
}

// Env var that holds the Stripe price ID for each plan/interval. Populated by
// `npm run stripe:seed`.
export const priceEnvVar: Record<PaidPlanKey, Record<BillingInterval, string>> = {
  standard: {
    monthly: 'STRIPE_PRICE_STANDARD_MONTHLY',
    yearly: 'STRIPE_PRICE_STANDARD_YEARLY',
  },
  professional: {
    monthly: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
    yearly: 'STRIPE_PRICE_PROFESSIONAL_YEARLY',
  },
  institutional: {
    monthly: 'STRIPE_PRICE_INSTITUTIONAL_MONTHLY',
    yearly: 'STRIPE_PRICE_INSTITUTIONAL_YEARLY',
  },
  legendary: {
    monthly: 'STRIPE_PRICE_LEGENDARY_MONTHLY',
    yearly: 'STRIPE_PRICE_LEGENDARY_YEARLY',
  },
}

export function isPaidPlan(value: string): value is PaidPlanKey {
  return (paidPlans as readonly string[]).includes(value)
}

// Rank for upgrade/downgrade comparison. free < standard < … < legendary.
export const planKeyRank: Record<'free' | PaidPlanKey, number> = {
  free: 0,
  standard: 1,
  professional: 2,
  institutional: 3,
  legendary: 4,
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
