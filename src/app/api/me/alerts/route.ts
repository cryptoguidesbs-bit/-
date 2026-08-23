import { NextRequest, NextResponse } from 'next/server'
import { recordEvent } from '@/lib/events'
import { z } from 'zod'

import { checkFeature } from '@/lib/entitlements'
import { checkLimit, limitResponse } from '@/lib/entitlements/limits'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'
import { ruleParamsSchemaByType } from '@/lib/alerts/types'

export const dynamic = 'force-dynamic'

// GET /api/me/alerts — the requester's alert rules (Trader+).
export async function GET() {
  const gate = await checkFeature('alerts.realtime')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rules = await prisma.alertRule.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ rules })
}

const createSchema = z.object({
  type: z.enum(['PRICE', 'WHALE', 'PATTERN', 'MACRO']),
  channel: z.enum(['INAPP', 'TELEGRAM', 'EMAIL', 'PUSH']),
  params: z.unknown(),
})

// POST /api/me/alerts — create a rule; params validated per alert type.
export async function POST(request: NextRequest) {
  const gate = await checkFeature('alerts.realtime')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid rule' }, { status: 400 })
  }
  const paramsParsed = ruleParamsSchemaByType[parsed.data.type].safeParse(parsed.data.params)
  if (!paramsParsed.success) {
    return NextResponse.json(
      { error: 'invalid params', issues: paramsParsed.error.issues.map((i) => i.message) },
      { status: 400 },
    )
  }

  // Per-plan cap (config/limits.ts) — counts every rule, paused included.
  const count = await prisma.alertRule.count({ where: { userId: user.id } })
  const cap = checkLimit(gate.plan, 'alertRules', count)
  if (!cap.allowed) return limitResponse(cap)

  const rule = await prisma.alertRule.create({
    data: {
      userId: user.id,
      type: parsed.data.type,
      channel: parsed.data.channel,
      params: paramsParsed.data,
    },
  })
  await recordEvent({ name: 'alert_rule_created', userId: user.id, meta: { type: rule.type } })
  return NextResponse.json({ ok: true, rule }, { status: 201 })
}
