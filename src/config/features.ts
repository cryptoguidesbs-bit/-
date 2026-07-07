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
  // Referral: the program itself is open to every signed-in member
  // (growth funnel); monetary rewards are additionally region-gated below.
  'referral.program': 'FREE',
  'referral.rewards': 'FREE',
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
// STAGE 22 — this is the launch-candidate region matrix. Each list and its
// rationale are documented in docs/region-matrix.md and must receive final
// attorney sign-off before production launch; runtime overrides
// (FeatureSwitch, admin console) allow adjusting any entry without a deploy
// once counsel confirms.
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
  // Monetary referral rewards — several jurisdictions regulate paid
  // referral/finder arrangements. The program (link/ranking) stays global;
  // commission accrual only happens in whitelisted countries. Placeholder
  // list pending the stage-22 legal review (docs/legal-review.md).
  'referral.rewards': {
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
