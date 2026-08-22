import { NextRequest, NextResponse } from 'next/server'

import { getRegulations } from '@/lib/map/regulation'
import { enforceRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// GET /api/map/regulation — country regulation badges/legend (our managed
// data). Informational only; not legal advice. Public read, rate limited.
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit({ name: 'map-regulation', limit: 60, request })
  if (limited) return limited

  const regulations = await getRegulations()
  return NextResponse.json({ regulations })
}
