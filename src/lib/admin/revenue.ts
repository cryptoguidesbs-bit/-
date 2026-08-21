import 'server-only'

import Stripe from 'stripe'

import { planAmounts } from '@/lib/payments/plans'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Revenue aggregation (stage 19). Two layers, both USD:
//   actuals  — Stripe charges (last 90 days) grouped by month and payment
//              method (card / crypto=USDC / other). Skipped gracefully when
//              Stripe is unreachable or unconfigured.
//   estimate — MRR from entitled subscriptions in our DB (plan monthly base;
//              yearly plans prorated /12).
// ---------------------------------------------------------------------------

const ENTITLED_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const

const MONTHLY_USD: Record<string, number> = {
  STARTER: planAmounts.starter.monthly,
  TRADER: planAmounts.trader.monthly,
  PRO: planAmounts.pro.monthly,
  WHALE: planAmounts.whale.monthly,
}
const YEARLY_USD: Record<string, number> = {
  STARTER: planAmounts.starter.yearly,
  TRADER: planAmounts.trader.yearly,
  PRO: planAmounts.pro.yearly,
  WHALE: planAmounts.whale.yearly,
}

export type RevenueSummary = {
  /** 'stripe' when actuals came from Stripe, 'db-only' otherwise. */
  source: 'stripe' | 'db-only'
  actuals: {
    monthly: { month: string; usd: number }[]
    byMethod: { card: number; usdc: number; other: number }
    totalUsd: number
  }
  mrrEstimate: {
    totalUsd: number
    byPlan: Record<string, { count: number; usd: number }>
  }
}

async function stripeActuals(): Promise<RevenueSummary['actuals'] | null> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  try {
    const stripe = new Stripe(key)
    const since = Math.floor((Date.now() - 90 * 86_400_000) / 1000)
    const monthly = new Map<string, number>()
    const byMethod = { card: 0, usdc: 0, other: 0 }
    let totalUsd = 0

    const charges = await stripe.charges.list({
      created: { gte: since },
      limit: 100,
    })
    for (const charge of charges.data) {
      if (charge.status !== 'succeeded' || !charge.paid) continue
      const usd = (charge.amount - (charge.amount_refunded ?? 0)) / 100
      totalUsd += usd
      const month = new Date(charge.created * 1000).toISOString().slice(0, 7)
      monthly.set(month, (monthly.get(month) ?? 0) + usd)

      const type = charge.payment_method_details?.type
      if (type === 'card') byMethod.card += usd
      else if (type === 'crypto') byMethod.usdc += usd
      else byMethod.other += usd
    }

    return {
      monthly: Array.from(monthly, ([month, usd]) => ({ month, usd })).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
      byMethod,
      totalUsd,
    }
  } catch {
    return null
  }
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  const [actuals, subs] = await Promise.all([
    stripeActuals(),
    prisma.subscription.findMany({
      where: { status: { in: [...ENTITLED_STATUSES] }, plan: { not: 'FREE' } },
      select: { plan: true, interval: true },
    }),
  ])

  const byPlan: Record<string, { count: number; usd: number }> = {}
  let totalUsd = 0
  for (const sub of subs) {
    const usd =
      sub.interval === 'YEARLY'
        ? Math.round(((YEARLY_USD[sub.plan] ?? 0) / 12) * 100) / 100
        : (MONTHLY_USD[sub.plan] ?? 0)
    byPlan[sub.plan] = {
      count: (byPlan[sub.plan]?.count ?? 0) + 1,
      usd: Math.round(((byPlan[sub.plan]?.usd ?? 0) + usd) * 100) / 100,
    }
    totalUsd = Math.round((totalUsd + usd) * 100) / 100
  }

  return {
    source: actuals ? 'stripe' : 'db-only',
    actuals: actuals ?? { monthly: [], byMethod: { card: 0, usdc: 0, other: 0 }, totalUsd: 0 },
    mrrEstimate: { totalUsd, byPlan },
  }
}
