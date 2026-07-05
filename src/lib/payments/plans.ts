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
