import type { SubscriptionPlan } from '@prisma/client'

// ---------------------------------------------------------------------------
// Plan-based feature matrix (A-3). Each feature names the MINIMUM plan that
// unlocks it; higher plans inherit everything below them.
// ---------------------------------------------------------------------------

export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  STANDARD: 1,
  PROFESSIONAL: 2,
  INSTITUTIONAL: 3,
  LEGENDARY: 4,
}

export const FEATURE_MIN_PLAN = {
  // Free
  'market.basic': 'FREE',
  'news.limited': 'FREE',
  'brief.limited': 'FREE',
  // Standard
  'news.full': 'STANDARD',
  'brief.daily': 'STANDARD',
  'dashboard.basic': 'STANDARD',
  // Professional
  'brief.detailed': 'PROFESSIONAL',
  'analysis.patterns': 'PROFESSIONAL',
  'portfolio.tools': 'PROFESSIONAL',
  'alerts.realtime': 'PROFESSIONAL',
  // Institutional
  'onchain.advanced': 'INSTITUTIONAL',
  'reports.premium': 'INSTITUTIONAL',
  // Legendary
  'api.center': 'LEGENDARY',
  'data.export': 'LEGENDARY',
} as const satisfies Record<string, SubscriptionPlan>

export type FeatureKey = keyof typeof FEATURE_MIN_PLAN

export const featureKeys = Object.keys(FEATURE_MIN_PLAN) as FeatureKey[]

export function planHasFeature(plan: SubscriptionPlan, feature: FeatureKey): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]]
}

// ---------------------------------------------------------------------------
// Region policy — feature-level on/off by country whitelist.
//
// A feature listed here is ONLY served in the whitelisted countries
// (ISO 3166-1 alpha-2, uppercase). Features not listed are available
// everywhere. `allowUnknown` decides what happens when the visitor's country
// cannot be determined (no geo header, e.g. local dev).
//
// NOTE: the country lists below are placeholder compliance policy — adjust
// them when the real legal review (stage 22) lands.
// ---------------------------------------------------------------------------

export type RegionPolicy = {
  whitelist: string[]
  allowUnknown: boolean
}

export const featureRegionPolicy: Partial<Record<FeatureKey, RegionPolicy>> = {
  'onchain.advanced': {
    whitelist: ['KR', 'US', 'JP', 'SG', 'GB', 'DE', 'FR', 'NL', 'CA', 'AU', 'HK', 'TW'],
    allowUnknown: true,
  },
  'api.center': {
    whitelist: ['KR', 'US', 'JP', 'SG', 'GB', 'DE', 'FR', 'NL', 'CA', 'AU'],
    allowUnknown: true,
  },
  'data.export': {
    whitelist: ['KR', 'US', 'JP', 'SG', 'GB', 'DE', 'FR', 'NL', 'CA', 'AU'],
    allowUnknown: true,
  },
}

export function isFeatureAllowedInCountry(feature: FeatureKey, country: string | null): boolean {
  const policy = featureRegionPolicy[feature]
  if (!policy) return true
  if (!country) return policy.allowUnknown
  return policy.whitelist.includes(country.toUpperCase())
}
