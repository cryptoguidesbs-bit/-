// Crypto Map test: access control (login required, all plans free), viewport
// (bbox) places API with filters + cap + too-wide guard, online services,
// regulation seed/serve, and the sync trigger (cron/admin, upstream-blocked
// to avoid a real BTCMap call). Map rendering itself is verified via SSR
// markers/testids (preview browser is unavailable in this env).
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

const APP = 'http://localhost:3000'
const EMAIL = 'flowtest+clerk_test@example.com'
const CRON = process.env.CRON_SECRET
const prisma = new PrismaClient()

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

async function clerkApi(path, method = 'GET', body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json().catch(() => null)
}
const users = await clerkApi(`/users?email_address=${encodeURIComponent(EMAIL)}`)
const session = await clerkApi('/sessions', 'POST', { user_id: users?.[0]?.id })
const tokRes = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', { expires_in_seconds: 600 })
const jwt = tokRes?.jwt
const me = await prisma.user.findFirst({ where: { email: EMAIL } })

const api = (path, { method = 'GET', authed = true, headers = {} } = {}) =>
  fetch(`${APP}${path}`, {
    method,
    headers: { ...(authed && jwt ? { authorization: `Bearer ${jwt}` } : {}), ...headers },
    redirect: 'manual',
  }).then(async (r) => ({ status: r.status, headers: r.headers, json: await r.json().catch(() => null) }))
const page = (path, authed = false) =>
  fetch(`${APP}${path}`, {
    headers: authed && jwt ? { authorization: `Bearer ${jwt}` } : {},
    redirect: 'manual',
  }).then(async (r) => ({ status: r.status, headers: r.headers, html: await r.text().catch(() => '') }))

async function cleanup() {
  await prisma.mapPlace.deleteMany({ where: { externalId: { startsWith: 'test:' } } })
}
await cleanup()

// Seed test places (externalId "test:*" so we never touch real synced data).
await prisma.mapPlace.createMany({
  data: [
    { source: 'BTCMAP', externalId: 'test:seoul-cafe', name: 'Seoul BTC Cafe', lat: 37.5665, lng: 126.978, category: 'cafe', coins: ['btc', 'lightning'], address: 'Seoul', countryCode: 'KR' },
    { source: 'BTCMAP', externalId: 'test:seoul-atm', name: 'Seoul ATM', lat: 37.57, lng: 126.98, category: 'atm', coins: ['btc'], address: 'Seoul', countryCode: 'KR' },
    { source: 'BTCMAP', externalId: 'test:nyc-shop', name: 'NYC Shop', lat: 40.7128, lng: -74.006, category: 'shop', coins: ['btc'], address: 'New York', countryCode: 'US' },
  ],
})

// --- 1. access control ---------------------------------------------------------
console.log('--- access control ---')
let res = await api('/api/map/places?bbox=126,37,128,38', { authed: false })
ok('places signed-out → 401', res.status === 401)

const pg = await page('/ko/map', false)
ok('page signed-out → redirect to sign-in',
  (pg.status === 307 || pg.status === 302) && (pg.headers.get('location') ?? '').includes('sign-in'),
  `status=${pg.status}`)

const pgAuth = await page('/ko/map', true)
ok('page signed-in → map page + disclaimer',
  pgAuth.status === 200 && pgAuth.html.includes('data-testid="map-page"') &&
    pgAuth.html.includes('data-testid="map-disclaimer"'))

// --- 2. viewport places --------------------------------------------------------
console.log('--- viewport places ---')
res = await api('/api/map/places')
ok('missing bbox → 400', res.status === 400)

res = await api('/api/map/places?bbox=-180,-85,180,85')
ok('too-wide bbox → tooWide (no pin flood)', res.status === 200 && res.json?.tooWide === true)

// Seoul viewport → 2 Seoul places, not NYC.
res = await api('/api/map/places?bbox=126.5,37.3,127.3,37.8')
const ids = (res.json?.places ?? []).map((p) => p.externalId ?? p.name)
ok('Seoul bbox returns Seoul places only',
  res.json?.places?.length === 2 && !JSON.stringify(res.json.places).includes('NYC'),
  `count=${res.json?.places?.length}`)

// coin filter
res = await api('/api/map/places?bbox=126.5,37.3,127.3,37.8&coins=lightning')
ok('coins=lightning filter', res.json?.places?.length === 1 && res.json.places[0].name.includes('Cafe'))

// category filter
res = await api('/api/map/places?bbox=126.5,37.3,127.3,37.8&category=atm')
ok('category=atm filter', res.json?.places?.length === 1 && res.json.places[0].category === 'atm')

// search
res = await api('/api/map/places?bbox=126.5,37.3,127.3,37.8&q=cafe')
ok('q=cafe search', res.json?.places?.length === 1)

// --- 3. online services --------------------------------------------------------
console.log('--- online services ---')
res = await api('/api/map/online')
ok('online services list', res.status === 200 && res.json?.services?.length >= 3)
res = await api('/api/map/online?coins=eth')
ok('online coin filter (eth)', res.json?.services?.every((s) => s.coins.includes('eth')))

// --- 4. regulation -------------------------------------------------------------
console.log('--- regulation ---')
res = await api('/api/map/regulation')
ok('regulation seeded + served',
  res.status === 200 && res.json?.regulations?.length >= 10 &&
    res.json.regulations.some((r) => r.countryCode === 'KR' && r.status))
res = await api('/api/map/regulation', { authed: false })
ok('regulation signed-out → 401', res.status === 401)

// --- 5. sync (cron/admin, upstream blocked) -----------------------------------
console.log('--- sync ---')
res = await api('/api/map/sync', { method: 'POST', authed: false })
ok('sync no auth → 401', res.status === 401)
res = await api('/api/map/sync', {
  method: 'POST',
  authed: false,
  headers: { 'x-cron-secret': CRON, 'x-test-block-upstream': '1' },
})
ok('sync with cron secret → 200 (upstream blocked, no crash)',
  res.status === 200 && res.json?.ok === true && res.json?.summary,
  JSON.stringify(res.json?.summary))

// --- cleanup -------------------------------------------------------------------
await cleanup()
await prisma.$disconnect()

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed — ${fail === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(fail === 0 ? 0 : 1)
