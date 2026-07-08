import 'server-only'

import type { Prisma } from '@prisma/client'

import { resilientFetch } from '@/lib/market/resilient'
import { prisma } from '@/lib/prisma'
import { btcmapSource, isDeleted, parseElement } from './btcmap'

export type SyncSummary = {
  fetched: number
  upserted: number
  removed: number
  stale: boolean
  source: string | null
}

// Sync BTCMap merchants/ATMs into MapPlace. Incremental when a prior sync
// exists (updated_since = latest syncedAt). resilientFetch keeps the last
// good snapshot if BTCMap is unreachable.
export async function syncBtcMap(opts: { blocked?: boolean } = {}): Promise<SyncSummary> {
  const last = await prisma.mapPlace.findFirst({
    where: { source: 'BTCMAP' },
    orderBy: { syncedAt: 'desc' },
    select: { syncedAt: true },
  })
  const updatedSince = last ? last.syncedAt.toISOString() : undefined

  const result = await resilientFetch('btcmap-elements', [btcmapSource(updatedSince)], {
    timeoutMs: 20_000,
    retries: 1,
    freshMs: 30 * 60_000,
    blocked: opts.blocked,
  })

  const elements = result.data ?? []
  let upserted = 0
  let removed = 0

  for (const el of elements) {
    if (isDeleted(el)) {
      const del = await prisma.mapPlace.deleteMany({
        where: { source: 'BTCMAP', externalId: el.id },
      })
      removed += del.count
      continue
    }
    const p = parseElement(el)
    if (!p) continue
    const data: Prisma.MapPlaceUncheckedCreateInput = {
      source: 'BTCMAP',
      externalId: p.externalId,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
      coins: p.coins,
      address: p.address,
      countryCode: p.countryCode,
      verifiedAt: p.verifiedAt,
      raw: p.raw as Prisma.InputJsonValue,
      syncedAt: new Date(),
    }
    await prisma.mapPlace.upsert({
      where: { source_externalId: { source: 'BTCMAP', externalId: p.externalId } },
      update: data,
      create: data,
    })
    upserted += 1
  }

  return {
    fetched: elements.length,
    upserted,
    removed,
    stale: result.stale,
    source: result.source,
  }
}
