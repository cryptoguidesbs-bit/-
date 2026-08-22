import { NextRequest, NextResponse } from 'next/server'

import { ONLINE_SERVICES } from '@/config/crypto-map-online'
import { enforceRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// GET /api/map/online?coins=btc&category=payments — curated online services.
// Public read, per-IP rate limited.
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit({ name: 'map-online', limit: 60, request })
  if (limited) return limited

  const coins = request.nextUrl.searchParams.get('coins')?.split(',').filter(Boolean)
  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase()

  let services = ONLINE_SERVICES
  if (coins?.length) services = services.filter((s) => s.coins.some((c) => coins.includes(c)))
  if (q) services = services.filter((s) => s.name.toLowerCase().includes(q))

  return NextResponse.json({ services })
}
