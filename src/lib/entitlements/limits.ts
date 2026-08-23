import 'server-only'

import { NextResponse } from 'next/server'
import type { SubscriptionPlan } from '@prisma/client'

import { planLimit, type LimitKey } from '@/config/limits'

export type LimitCheck = {
  key: LimitKey
  allowed: boolean
  limit: number | null
  used: number
  plan: SubscriptionPlan
}

/** Compare current usage against the plan's cap (null = unlimited). */
export function checkLimit(plan: SubscriptionPlan, key: LimitKey, used: number): LimitCheck {
  const limit = planLimit(plan, key)
  return { key, allowed: limit === null || used < limit, limit, used, plan }
}

/** Uniform 409 body for "you have reached your plan's cap" responses. */
export function limitResponse(check: LimitCheck) {
  return NextResponse.json(
    { error: 'limit reached', key: check.key, limit: check.limit, used: check.used, plan: check.plan },
    { status: 409 },
  )
}
