import { NextRequest, NextResponse } from 'next/server'

import { ONLINE_SERVICES } from '@/config/crypto-map-online'
import { getDbUser } from '@/lib/user'

export const dynamic = 'force-dynamic'

// GET /api/map/online?coins=btc&category=payments — curated online services.
export async function GET(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const coins = request.nextUrl.searchParams.get('coins')?.split(',').filter(Boolean)
  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase()

  let services = ONLINE_SERVICES
  if (coins?.length) services = services.filter((s) => s.coins.some((c) => coins.includes(c)))
  if (q) services = services.filter((s) => s.name.toLowerCase().includes(q))

  return NextResponse.json({ services })
}
