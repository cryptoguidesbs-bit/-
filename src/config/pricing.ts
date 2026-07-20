import { planAmounts, type BillingInterval, type PaidPlanKey } from '@/lib/payments/plans'

// Pricing matrix — all prices in USD. Amounts for paid tiers come from the
// payments layer (single source of truth shared with Stripe seeding).
export type PricingTierKey = 'free' | PaidPlanKey

export type PricingTier = {
  key: PricingTierKey
  featureCount: number
  popular?: boolean
}

export const pricingTiers: PricingTier[] = [
  { key: 'free', featureCount: 3 },
  { key: 'starter', featureCount: 3 },
  { key: 'trader', featureCount: 5, popular: true },
  { key: 'pro', featureCount: 3 },
  { key: 'whale', featureCount: 3 },
]

export function tierAmount(key: PricingTierKey, interval: BillingInterval): number {
  if (key === 'free') return 0
  return planAmounts[key][interval]
}
