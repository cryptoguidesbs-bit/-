import 'server-only'

import { isFeatureAllowedInCountry, type FeatureKey } from '@/config/features'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Runtime region switches (stage 19). Admin-managed FeatureSwitch rows
// override the static featureRegionPolicy so regulation changes take effect
// immediately, without a deploy:
//   enabled=false        → feature blocked everywhere
//   whitelist non-empty  → replaces the config whitelist (allowUnknown too)
//   whitelist empty      → config policy applies as usual
// Cached briefly per process; admin writes invalidate the cache.
// ---------------------------------------------------------------------------

export type RegionOverride = {
  enabled: boolean
  whitelist: string[]
  allowUnknown: boolean | null
}

type Cache = { loadedAt: number; data: Map<string, RegionOverride> }

const CACHE_TTL_MS = 10_000
const g = globalThis as Record<string, unknown>

export async function getRegionOverrides(): Promise<Map<string, RegionOverride>> {
  const cached = g.__regionOverrides as Cache | undefined
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.data

  const rows = await prisma.featureSwitch.findMany().catch(() => [])
  const data = new Map<string, RegionOverride>(
    rows.map((row) => [
      row.feature,
      { enabled: row.enabled, whitelist: row.whitelist, allowUnknown: row.allowUnknown },
    ]),
  )
  g.__regionOverrides = { loadedAt: Date.now(), data } satisfies Cache
  return data
}

export function invalidateRegionOverrides() {
  delete g.__regionOverrides
}

export function allowedWithOverride(
  feature: FeatureKey,
  country: string | null,
  overrides: Map<string, RegionOverride>,
): boolean {
  const override = overrides.get(feature)
  if (override) {
    if (!override.enabled) return false
    if (override.whitelist.length > 0) {
      if (!country) return override.allowUnknown ?? true
      return override.whitelist.includes(country.toUpperCase())
    }
    // enabled with no whitelist → fall through to the static config policy
  }
  return isFeatureAllowedInCountry(feature, country)
}

/** Async convenience for callers outside the entitlements evaluator. */
export async function isFeatureAllowedInCountryLive(
  feature: FeatureKey,
  country: string | null,
): Promise<boolean> {
  return allowedWithOverride(feature, country, await getRegionOverrides())
}
