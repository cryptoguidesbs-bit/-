import 'server-only'

import { categorizeOsm } from '@/config/crypto-map'
import { assertUpstreamOk, type Source } from '@/lib/market/resilient'

// BTCMap v2 element (subset we use).
type OsmTags = Record<string, string>
type BtcMapElement = {
  id: string // e.g. "node:12345"
  osm_json?: {
    type?: 'node' | 'way' | 'relation'
    lat?: number
    lon?: number
    bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number }
    tags?: OsmTags
  }
  tags?: Record<string, unknown>
  deleted_at?: string | null
}

export type ParsedPlace = {
  externalId: string
  name: string | null
  lat: number
  lng: number
  category: string
  coins: string[]
  address: string | null
  countryCode: string | null
  verifiedAt: Date | null
  raw: OsmTags
}

const BTCMAP_ELEMENTS_URL = 'https://api.btcmap.org/v2/elements'

// One BTCMap source for resilientFetch. `updatedSince` enables incremental
// sync; omit for the initial full pull.
export function btcmapSource(updatedSince?: string): Source<BtcMapElement[]> {
  const url = updatedSince
    ? `${BTCMAP_ELEMENTS_URL}?updated_since=${encodeURIComponent(updatedSince)}`
    : BTCMAP_ELEMENTS_URL
  return {
    name: 'btcmap-elements',
    async fetch(signal) {
      const res = await fetch(url, { signal, cache: 'no-store' })
      assertUpstreamOk(res, 'btcmap')
      const json = (await res.json()) as BtcMapElement[]
      if (!Array.isArray(json)) throw new Error('btcmap: unexpected payload')
      return json
    },
  }
}

function coordsOf(el: BtcMapElement): { lat: number; lng: number } | null {
  const o = el.osm_json
  if (!o) return null
  if (typeof o.lat === 'number' && typeof o.lon === 'number') return { lat: o.lat, lng: o.lon }
  if (o.bounds) {
    return {
      lat: (o.bounds.minlat + o.bounds.maxlat) / 2,
      lng: (o.bounds.minlon + o.bounds.maxlon) / 2,
    }
  }
  return null
}

function coinsOf(tags: OsmTags): string[] {
  const out = new Set<string>()
  const yes = (v?: string) => v === 'yes' || v === 'only'
  if (yes(tags['payment:bitcoin']) || yes(tags['currency:XBT']) || yes(tags['payment:onchain']))
    out.add('btc')
  if (yes(tags['payment:lightning']) || yes(tags['payment:lightning_contactless']))
    out.add('lightning')
  // Default assumption for BTCMap entries with no explicit payment tag.
  if (out.size === 0) out.add('btc')
  return Array.from(out)
}

function addressOf(tags: OsmTags): string | null {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:country'],
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function verifiedOf(tags: OsmTags): Date | null {
  const raw = tags['survey:date'] || tags['check_date'] || tags['check_date:currency:XBT']
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Parse a BTCMap element into our shape, or null to skip (deleted/no coords). */
export function parseElement(el: BtcMapElement): ParsedPlace | null {
  if (el.deleted_at) return null
  const coords = coordsOf(el)
  if (!coords) return null
  const tags = el.osm_json?.tags ?? {}

  return {
    externalId: el.id,
    name: tags.name ?? null,
    lat: coords.lat,
    lng: coords.lng,
    category: categorizeOsm(tags),
    coins: coinsOf(tags),
    address: addressOf(tags),
    countryCode: tags['addr:country']?.toUpperCase() ?? null,
    verifiedAt: verifiedOf(tags),
    raw: tags,
  }
}

/** Elements that are deletions (for incremental sync cleanup). */
export function isDeleted(el: BtcMapElement): boolean {
  return !!el.deleted_at
}
