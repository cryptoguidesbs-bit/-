import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { MAP_PLACES_LIMIT } from '@/config/crypto-map'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/map/places?bbox=minLng,minLat,maxLng,maxLat&coins=btc,lightning
//   &category=cafe&q=search — viewport places for signed-in members.
// All plans free; login required.
export async function GET(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const bbox = params.get('bbox')?.split(',').map(Number)
  if (!bbox || bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: 'bbox required (minLng,minLat,maxLng,maxLat)' }, { status: 400 })
  }
  const [minLng, minLat, maxLng, maxLat] = bbox

  // Reject absurdly large bboxes (whole-world pin loads) — the client shows
  // the regulation layer at low zoom instead.
  if (Math.abs(maxLat - minLat) > 40 || Math.abs(maxLng - minLng) > 60) {
    return NextResponse.json({ places: [], count: 0, capped: false, tooWide: true })
  }

  const where: Prisma.MapPlaceWhereInput = {
    lat: { gte: minLat, lte: maxLat },
    lng: { gte: minLng, lte: maxLng },
  }

  const coins = params.get('coins')?.split(',').filter(Boolean)
  if (coins?.length) where.coins = { hasSome: coins }

  const category = params.get('category')
  if (category) where.category = category

  const q = params.get('q')?.trim()
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { address: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.mapPlace.findMany({
    where,
    take: MAP_PLACES_LIMIT + 1,
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      category: true,
      coins: true,
      address: true,
      countryCode: true,
      verifiedAt: true,
    },
  })

  const capped = rows.length > MAP_PLACES_LIMIT
  const places = capped ? rows.slice(0, MAP_PLACES_LIMIT) : rows

  return NextResponse.json(
    { places, count: places.length, capped },
    { headers: { 'cache-control': 'private, max-age=30' } },
  )
}
