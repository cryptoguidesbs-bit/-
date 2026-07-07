import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin/auth'
import { getRevenueSummary } from '@/lib/admin/revenue'

export const dynamic = 'force-dynamic'

// GET /api/admin/revenue — Stripe actuals (card/USDC unified, USD) + DB MRR.
export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.response

  return NextResponse.json(await getRevenueSummary())
}
