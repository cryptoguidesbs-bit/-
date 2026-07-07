import { NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/me/api-usage — 30-day usage aggregation across my keys.
export async function GET() {
  const gate = await checkFeature('api.center')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const rows = await prisma.apiUsage.findMany({
    where: { apiKey: { userId: user.id }, day: { gte: since } },
    orderBy: [{ day: 'desc' }],
    select: {
      day: true,
      endpoint: true,
      count: true,
      apiKey: { select: { id: true, name: true, prefix: true } },
    },
  })

  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const byEndpoint: Record<string, number> = {}
  for (const r of rows) byEndpoint[r.endpoint] = (byEndpoint[r.endpoint] ?? 0) + r.count

  return NextResponse.json({ total, byEndpoint, rows })
}
