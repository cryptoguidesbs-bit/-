import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { featureKeys, featureRegionPolicy } from '@/config/features'
import { requireAdmin } from '@/lib/admin/auth'
import { invalidateRegionOverrides } from '@/lib/entitlements/region'
import { logSecurityEvent } from '@/lib/security/audit'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/region-switches — static policy + runtime overrides.
export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const overrides = await prisma.featureSwitch.findMany()
  return NextResponse.json({
    features: featureKeys.map((feature) => ({
      feature,
      configPolicy: featureRegionPolicy[feature] ?? null,
      override: overrides.find((o) => o.feature === feature) ?? null,
    })),
  })
}

const putSchema = z.object({
  feature: z.enum(featureKeys as [string, ...string[]]),
  enabled: z.boolean(),
  whitelist: z.array(z.string().length(2)).max(250).optional(),
  allowUnknown: z.boolean().nullable().optional(),
})

// PUT /api/admin/region-switches — set/replace a runtime switch.
// Takes effect immediately (cache invalidated) — no deploy needed.
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const parsed = putSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid switch' }, { status: 400 })

  const data = {
    enabled: parsed.data.enabled,
    whitelist: (parsed.data.whitelist ?? []).map((c) => c.toUpperCase()),
    allowUnknown: parsed.data.allowUnknown ?? null,
    updatedBy: admin.user.email,
  }
  const saved = await prisma.featureSwitch.upsert({
    where: { feature: parsed.data.feature },
    update: data,
    create: { feature: parsed.data.feature, ...data },
  })
  invalidateRegionOverrides()
  await logSecurityEvent({
    action: 'admin.region_switch.set',
    userId: admin.user.id,
    actorEmail: admin.user.email,
    request,
    meta: { feature: parsed.data.feature, enabled: data.enabled, whitelist: data.whitelist },
  })
  return NextResponse.json({ ok: true, switch: saved })
}

const deleteSchema = z.object({ feature: z.enum(featureKeys as [string, ...string[]]) })

// DELETE /api/admin/region-switches — remove an override (config applies).
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid feature' }, { status: 400 })

  await prisma.featureSwitch.deleteMany({ where: { feature: parsed.data.feature } })
  invalidateRegionOverrides()
  return NextResponse.json({ ok: true })
}
