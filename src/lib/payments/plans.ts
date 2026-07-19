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

// ---------------------------------------------------------------------------
// Billing terms — a presentation layer over the monthly/yearly rails so the
// pricing page can offer several commitment lengths (months and years). Month
// terms bill at the monthly rate (no discount); year terms bill at the yearly
// rate (10× monthly ⇒ 2 months free, ~17% off). Each term maps to one of the
// two real Stripe intervals, so no new products/prices or schema changes.
// ---------------------------------------------------------------------------
export type BillingUnit = 'month' | 'year'
export type BillingTermKey = '1m' | '3m' | '6m' | '1y' | '2y' | '3y'

export type BillingTerm = {
  key: BillingTermKey
  unit: BillingUnit
  /** Number of units in the term (e.g. 3 months, 2 years). */
  count: number
  /** Total months the term spans — drives the "per month" figure. */
  months: number
  /** Which real billing rail this term checks out on. */
  interval: BillingInterval
}

export const billingTerms: BillingTerm[] = [
  { key: '1m', unit: 'month', count: 1, months: 1, interval: 'monthly' },
  { key: '3m', unit: 'month', count: 3, months: 3, interval: 'monthly' },
  { key: '6m', unit: 'month', count: 6, months: 6, interval: 'monthly' },
  { key: '1y', unit: 'year', count: 1, months: 12, interval: 'yearly' },
  { key: '2y', unit: 'year', count: 2, months: 24, interval: 'yearly' },
  { key: '3y', unit: 'year', count: 3, months: 36, interval: 'yearly' },
]

export function findBillingTerm(key: string): BillingTerm | undefined {
  return billingTerms.find((term) => term.key === key)
}

/** Total charged over the whole term, in whole USD. */
export function termTotal(plan: PaidPlanKey, term: BillingTerm): number {
  const perCycle = term.unit === 'year' ? planAmounts[plan].yearly : planAmounts[plan].monthly
  return perCycle * term.count
}

/** Effective monthly cost over the term (whole USD, rounded) — for "월 환산". */
export function termPerMonth(plan: PaidPlanKey, term: BillingTerm): number {
  return Math.round(termTotal(plan, term) / term.months)
}

/** What paying the plain monthly rate for the same span would cost. */
export function termUndiscountedTotal(plan: PaidPlanKey, term: BillingTerm): number {
  return planAmounts[plan].monthly * term.months
}

/** Money saved vs the plain monthly rate for the same span (0 for month terms). */
export function termSaved(plan: PaidPlanKey, term: BillingTerm): number {
  return termUndiscountedTotal(plan, term) - termTotal(plan, term)
}

/** Discount vs the plain monthly rate for the same span. Year terms → ~17%. */
export function termDiscountPct(term: BillingTerm): number {
  return term.unit === 'year' ? YEARLY_DISCOUNT_PCT : 0
}

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
