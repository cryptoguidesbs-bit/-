import {
  planAmounts,
  termTotal,
  termPerMonth,
  termUndiscountedTotal,
  termSaved,
  type BillingInterval,
  type BillingTerm,
  type PaidPlanKey,
} from '@/lib/payments/plans'

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

// Term-aware variants (free → 0). Used by the multi-term pricing UI.
export function tierTermTotal(key: PricingTierKey, term: BillingTerm): number {
  return key === 'free' ? 0 : termTotal(key, term)
}
export function tierTermPerMonth(key: PricingTierKey, term: BillingTerm): number {
  return key === 'free' ? 0 : termPerMonth(key, term)
}
export function tierTermUndiscounted(key: PricingTierKey, term: BillingTerm): number {
  return key === 'free' ? 0 : termUndiscountedTotal(key, term)
}
export function tierTermSaved(key: PricingTierKey, term: BillingTerm): number {
  return key === 'free' ? 0 : termSaved(key, term)
}
