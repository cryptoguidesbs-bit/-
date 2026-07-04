// A-3 pricing matrix — all prices in USD, monthly.
export type PricingTier = {
  key: 'free' | 'standard' | 'professional' | 'institutional' | 'legendary'
  priceMonthly: number
  featureCount: number
  popular?: boolean
}

export const pricingTiers: PricingTier[] = [
  { key: 'free', priceMonthly: 0, featureCount: 3 },
  { key: 'standard', priceMonthly: 199, featureCount: 3 },
  { key: 'professional', priceMonthly: 499, featureCount: 5, popular: true },
  { key: 'institutional', priceMonthly: 1499, featureCount: 3 },
  { key: 'legendary', priceMonthly: 4999, featureCount: 3 },
]
