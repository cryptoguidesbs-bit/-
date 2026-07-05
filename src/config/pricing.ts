import { planAmounts, type BillingInterval, type PaidPlanKey } from '@/lib/payments/plans'

// A-3 pricing matrix — all prices in USD. Amounts for paid tiers come from
// the payments layer (single source of truth shared with Stripe seeding).
export type PricingTierKey = 'free' | PaidPlanKey

export type PricingTier = {
  key: PricingTierKey
  featureCount: number
  popular?: boolean
}

export const pricingTiers: PricingTier[] = [
  { key: 'free', featureCount: 3 },
  { key: 'standard', featureCount: 3 },
  { key: 'professional', featureCount: 5, popular: true },
  { key: 'institutional', featureCount: 3 },
  { key: 'legendary', featureCount: 3 },
]

export function tierAmount(key: PricingTierKey, interval: BillingInterval): number {
  if (key === 'free') return 0
  return planAmounts[key][interval]
}
