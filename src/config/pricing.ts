import { planAmounts, type BillingInterval, type PaidPlanKey } from '@/lib/payments/plans'

// Pricing matrix — all prices in USD. Amounts for paid tiers come from the
// payments layer (single source of truth shared with Stripe seeding).
//
// 'enterprise' is contract-priced: it has NO Stripe product/price and never
// reaches checkout. The card and the comparison row show a "from" figure and
// route to the Contact Sales form instead.
export type PricingTierKey = 'free' | PaidPlanKey | 'enterprise'

export type PricingTier = {
  key: PricingTierKey
  featureCount: number
  popular?: boolean
  /** Quote-only tier: renders a contact CTA instead of a checkout button. */
  contact?: boolean
}

export const pricingTiers: PricingTier[] = [
  { key: 'free', featureCount: 3 },
  { key: 'starter', featureCount: 3 },
  { key: 'trader', featureCount: 5, popular: true },
  { key: 'pro', featureCount: 3 },
  { key: 'whale', featureCount: 3 },
  { key: 'enterprise', featureCount: 14, contact: true },
]

/** Entry price shown as "From $X/mo" on the Enterprise card. Not billed by Stripe. */
export const ENTERPRISE_FROM_MONTHLY = 1999

export function isContactTier(key: PricingTierKey): key is 'enterprise' {
  return key === 'enterprise'
}

export function tierAmount(key: PricingTierKey, interval: BillingInterval): number {
  if (key === 'free' || key === 'enterprise') return 0
  return planAmounts[key][interval]
}
