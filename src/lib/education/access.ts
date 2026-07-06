import 'server-only'

import { PLAN_RANK } from '@/config/features'
import type { LessonAccess } from '@/config/education'
import { getEntitlements } from '@/lib/entitlements'

// Conversion-funnel access model:
//   free     → everyone (signed-out included)
//   member   → any signed-in account (sign-up funnel)
//   standard → Standard plan and above (subscription funnel)
export type LessonGate = {
  allowed: boolean
  reason: 'ok' | 'auth' | 'plan'
  signedIn: boolean
  plan: string
}

export async function checkLessonAccess(access: LessonAccess): Promise<LessonGate> {
  if (access === 'free') {
    return { allowed: true, reason: 'ok', signedIn: false, plan: 'FREE' }
  }
  const ent = await getEntitlements()
  if (!ent.signedIn) {
    return { allowed: false, reason: 'auth', signedIn: false, plan: ent.plan }
  }
  if (access === 'member') {
    return { allowed: true, reason: 'ok', signedIn: true, plan: ent.plan }
  }
  const allowed = PLAN_RANK[ent.plan] >= PLAN_RANK.STANDARD
  return { allowed, reason: allowed ? 'ok' : 'plan', signedIn: true, plan: ent.plan }
}

/** Resolve the viewer's lock state for every access tier at once. */
export async function getAccessSnapshot(): Promise<Record<LessonAccess, boolean>> {
  const ent = await getEntitlements()
  return {
    free: true,
    member: ent.signedIn,
    standard: ent.signedIn && PLAN_RANK[ent.plan] >= PLAN_RANK.STANDARD,
  }
}
