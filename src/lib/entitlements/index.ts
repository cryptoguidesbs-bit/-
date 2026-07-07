import 'server-only'

import { headers } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import type { SubscriptionPlan, SubscriptionStatus, UserRole } from '@prisma/client'

import {
  FEATURE_MIN_PLAN,
  featureKeys,
  planHasFeature,
  type FeatureKey,
} from '@/config/features'
import {
  allowedWithOverride,
  getRegionOverrides,
  type RegionOverride,
} from '@/lib/entitlements/region'
import { prisma } from '@/lib/prisma'

// Statuses that keep paid entitlements. PAST_DUE gets a grace period while
// the provider retries payment.
const ENTITLED_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE']

export type GateReason = 'ok' | 'auth' | 'plan' | 'region'

export type FeatureCheck = {
  feature: FeatureKey
  allowed: boolean
  reason: GateReason
  requiredPlan: SubscriptionPlan
  plan: SubscriptionPlan
  signedIn: boolean
  country: string | null
}

export type Entitlements = {
  signedIn: boolean
  plan: SubscriptionPlan
  role: UserRole | null
  country: string | null
  features: Record<FeatureKey, { allowed: boolean; reason: GateReason }>
}

// Country from the hosting platform's geo header. Locally there is none →
// null (policies decide via allowUnknown). Behind Vercel/Cloudflare the
// header is set by the platform and cannot be spoofed by clients.
function requestCountry(): string | null {
  const h = headers()
  return (
    h.get('x-vercel-ip-country')?.toUpperCase() ?? h.get('cf-ipcountry')?.toUpperCase() ?? null
  )
}

async function resolvePlanAndRole(): Promise<{
  signedIn: boolean
  plan: SubscriptionPlan
  role: UserRole | null
}> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { signedIn: false, plan: 'FREE', role: null }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: true },
  })
  if (!user) return { signedIn: true, plan: 'FREE', role: null }

  // Staff bypass: admins see every feature (region rules still apply).
  if (user.role === 'ADMIN') return { signedIn: true, plan: 'LEGENDARY', role: user.role }

  const sub = user.subscription
  const plan: SubscriptionPlan =
    sub && ENTITLED_STATUSES.includes(sub.status) ? sub.plan : 'FREE'
  return { signedIn: true, plan, role: user.role }
}

function evaluate(
  feature: FeatureKey,
  ctx: {
    signedIn: boolean
    plan: SubscriptionPlan
    country: string | null
    overrides: Map<string, RegionOverride>
  },
): { allowed: boolean; reason: GateReason } {
  // Region rules are absolute — they apply regardless of plan. Runtime
  // admin switches (stage 19) override the static config policy.
  if (!allowedWithOverride(feature, ctx.country, ctx.overrides)) {
    return { allowed: false, reason: 'region' }
  }
  if (planHasFeature(ctx.plan, feature)) {
    return { allowed: true, reason: 'ok' }
  }
  // Signed-out users are asked to sign in first; their account may already
  // carry the required plan.
  return { allowed: false, reason: ctx.signedIn ? 'plan' : 'auth' }
}

/** Check a single feature for the current request. */
export async function checkFeature(feature: FeatureKey): Promise<FeatureCheck> {
  const country = requestCountry()
  const [{ signedIn, plan }, overrides] = await Promise.all([
    resolvePlanAndRole(),
    getRegionOverrides(),
  ])
  const { allowed, reason } = evaluate(feature, { signedIn, plan, country, overrides })
  return {
    feature,
    allowed,
    reason,
    requiredPlan: FEATURE_MIN_PLAN[feature],
    plan,
    signedIn,
    country,
  }
}

/** Full feature matrix for the current request (signed-out → FREE). */
export async function getEntitlements(): Promise<Entitlements> {
  const country = requestCountry()
  const [{ signedIn, plan, role }, overrides] = await Promise.all([
    resolvePlanAndRole(),
    getRegionOverrides(),
  ])

  const features = {} as Entitlements['features']
  for (const feature of featureKeys) {
    features[feature] = evaluate(feature, { signedIn, plan, country, overrides })
  }

  return { signedIn, plan, role, country, features }
}
