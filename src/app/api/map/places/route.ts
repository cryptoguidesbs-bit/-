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

  // Reject only truly continental/world bboxes — clustering handles the
  // rest, so region- and country-level views still load (and cluster).
  if (Math.abs(maxLat - minLat) > 70 || Math.abs(maxLng - minLng) > 140) {
    return NextResponse.json({ places: [], count: 0, capped: false, tooWide: true })
  }

  // Longitudes can arrive outside [-180, 180] — Leaflet reports getEast() > 180
  // (or getWest() < -180) when the viewport is panned across the antimeridian,
  // while stored places use normalized [-180, 180]. Normalize the bounds, and
  // when the box straddles ±180° split the longitude filter into two ranges
  // under AND so it never clobbers the `q` search OR added below.
  const wrapLng = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180
  const west = wrapLng(minLng)
  const east = wrapLng(maxLng)

  const where: Prisma.MapPlaceWhereInput = {
    lat: { gte: minLat, lte: maxLat },
  }
  if (west <= east) {
    where.lng = { gte: west, lte: east }
  } else {
    // Straddles the antimeridian → [west, 180] OR [-180, east].
    where.AND = [{ OR: [{ lng: { gte: west } }, { lng: { lte: east } }] }]
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
