import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'
import { ruleParamsSchemaByType } from '@/lib/alerts/types'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  active: z.boolean().optional(),
  channel: z.enum(['INAPP', 'TELEGRAM', 'EMAIL', 'PUSH']).optional(),
  params: z.unknown().optional(),
})

// PATCH /api/me/alerts/:id — toggle/update a rule (ownership enforced).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rule = await prisma.alertRule.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!rule) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid patch' }, { status: 400 })

  let ruleParams = undefined
  if (parsed.data.params !== undefined) {
    const paramsParsed = ruleParamsSchemaByType[rule.type].safeParse(parsed.data.params)
    if (!paramsParsed.success) {
      return NextResponse.json({ error: 'invalid params' }, { status: 400 })
    }
    ruleParams = paramsParsed.data
  }

  const updated = await prisma.alertRule.update({
    where: { id: rule.id },
    data: {
      active: parsed.data.active,
      channel: parsed.data.channel,
      params: ruleParams,
    },
  })
  return NextResponse.json({ ok: true, rule: updated })
}

// DELETE /api/me/alerts/:id — remove a rule (ownership enforced).
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const deleted = await prisma.alertRule.deleteMany({
    where: { id: params.id, userId: user.id },
  })
  if (deleted.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
