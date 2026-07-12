// One-off initial BTCMap load: full /v2/elements dump → MapPlace, batched
// createMany (much faster than the per-row upsert in the incremental route).
// Safe to re-run: skipDuplicates on (source, externalId). Subsequent syncs
// use POST /api/map/sync (incremental via updated_since).
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
}
loadEnv('.env.local')
loadEnv('.env')

const prisma = new PrismaClient()

// Mirrors src/config/crypto-map.ts categorizeOsm + src/lib/map/btcmap.ts.
function categorize(tags) {
  if (!tags) return 'other'
  const { amenity, shop, tourism } = tags
  if (amenity === 'atm') return 'atm'
  if (amenity === 'cafe') return 'cafe'
  if (amenity === 'restaurant' || amenity === 'fast_food') return 'restaurant'
  if (amenity === 'bar' || amenity === 'pub' || amenity === 'nightclub') return 'bar'
  if (tourism === 'hotel' || tourism === 'guest_house' || tourism === 'hostel') return 'lodging'
  if (shop === 'supermarket' || shop === 'convenience' || shop === 'grocery') return 'grocery'
  if (shop) return 'shop'
  if (amenity) return 'service'
  return 'other'
}
const yes = (v) => v === 'yes' || v === 'only'
function coinsOf(tags) {
  const out = new Set()
  if (yes(tags['payment:bitcoin']) || yes(tags['currency:XBT']) || yes(tags['payment:onchain'])) out.add('btc')
  if (yes(tags['payment:lightning']) || yes(tags['payment:lightning_contactless'])) out.add('lightning')
  if (out.size === 0) out.add('btc')
  return Array.from(out)
}
function parseElement(el) {
  if (el.deleted_at) return null
  const o = el.osm_json
  if (!o) return null
  let lat, lng
  if (typeof o.lat === 'number' && typeof o.lon === 'number') {
    lat = o.lat
    lng = o.lon
  } else if (o.bounds) {
    lat = (o.bounds.minlat + o.bounds.maxlat) / 2
    lng = (o.bounds.minlon + o.bounds.maxlon) / 2
  } else return null
  const tags = o.tags ?? {}
  const addr = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:country']]
    .filter(Boolean)
    .join(', ')
  const verifiedRaw = tags['survey:date'] || tags['check_date'] || tags['check_date:currency:XBT']
  const verifiedAt = verifiedRaw && !Number.isNaN(new Date(verifiedRaw).getTime()) ? new Date(verifiedRaw) : null
  return {
    source: 'BTCMAP',
    externalId: el.id,
    name: tags.name ?? null,
    lat,
    lng,
    category: categorize(tags),
    coins: coinsOf(tags),
    address: addr || null,
    countryCode: tags['addr:country']?.toUpperCase()?.slice(0, 2) ?? null,
    verifiedAt,
    syncedAt: new Date(),
  }
}

console.log('Downloading BTCMap full dump (this can take a minute)…')
const res = await fetch('https://api.btcmap.org/v2/elements')
if (!res.ok) {
  console.error(`BTCMap responded ${res.status}`)
  process.exit(1)
}
const elements = await res.json()
console.log(`Fetched ${elements.length} elements. Parsing…`)

const rows = []
let skipped = 0
for (const el of elements) {
  const p = parseElement(el)
  if (p) rows.push(p)
  else skipped++
}
console.log(`Parsed ${rows.length} places (skipped ${skipped}: deleted/no-coords). Inserting…`)

let inserted = 0
for (let i = 0; i < rows.length; i += 1000) {
  const batch = rows.slice(i, i + 1000)
  const r = await prisma.mapPlace.createMany({ data: batch, skipDuplicates: true })
  inserted += r.count
  if ((i / 1000) % 10 === 0) process.stdout.write(`  ${Math.min(i + 1000, rows.length)}/${rows.length}\r`)
}

const total = await prisma.mapPlace.count()
const seoul = await prisma.mapPlace.count({
  where: { lat: { gte: 37.3, lte: 37.8 }, lng: { gte: 126.5, lte: 127.3 } },
})
const atms = await prisma.mapPlace.count({ where: { category: 'atm' } })
console.log(`\nDone. inserted=${inserted}, table total=${total}, Seoul-area=${seoul}, ATMs=${atms}`)
await prisma.$disconnect()
