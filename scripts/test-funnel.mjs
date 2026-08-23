// Funnel events + operator board tiles + per-plan limits:
//   /api/events (allowlist, client-only names, CSRF same-origin, rate limit,
//   ProductEvent rows), /api/admin/board funnel + viewsToday, and the
//   PLAN_LIMITS caps (watchlist / alert rules / api keys) with 409 responses.
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
const prisma = new PrismaClient()

let passCount = 0
let failCount = 0
const ok = (name, pass, detail = '') => {
  if (pass) passCount++
  else failCount++
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

async function clerkApi(path, method = 'GET', body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json().catch(() => null)
}
const users = await clerkApi(`/users?email_address=${encodeURIComponent(EMAIL)}`)
const session = await clerkApi('/sessions', 'POST', { user_id: users?.[0]?.id })
const tokenRes = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', { expires_in_seconds: 600 })
const jwt = tokenRes?.jwt
const me = await prisma.user.findFirst({ where: { email: EMAIL } })
if (!jwt || !me) {
  console.log('FAIL — test user/session unavailable')
  process.exit(1)
}

const api = async (path, { method = 'GET', body, authed = true, headers = {} } = {}) => {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: {
      ...(authed && jwt ? { authorization: `Bearer ${jwt}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null), headers: res.headers }
}
const sameOrigin = { origin: APP }
const postEvent = (body, headers = {}) =>
  fetch(`${APP}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...sameOrigin, ...headers },
    body: JSON.stringify(body),
  })

async function setPlan(plan) {
  await prisma.subscription.deleteMany({ where: { userId: me.id } })
  if (plan === 'FREE') return
  await prisma.subscription.create({
    data: {
      userId: me.id,
      plan,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  })
}

const before = await prisma.productEvent.count()

// --- 1. /api/events ----------------------------------------------------------------
console.log('--- events endpoint ---')
let res = await postEvent({ name: 'brief_view', path: '/en/brief', locale: 'en' })
ok('page-view event → 204', res.status === 204)
res = await postEvent({ name: 'paid_cta_click', path: '/en', locale: 'en' })
ok('paid CTA click → 204', res.status === 204)
res = await postEvent({ name: 'signup' })
ok('server-only event name from client → 400', res.status === 400)
res = await postEvent({ name: 'made_up_event' })
ok('unknown event name → 400', res.status === 400)
res = await postEvent({ name: 'brief_view', locale: 'xx' })
ok('bad locale is tolerated (stored as null)', res.status === 204)
res = await fetch(`${APP}/api/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  body: JSON.stringify({ name: 'brief_view' }),
})
ok('cross-origin event POST → 403', res.status === 403)
// Signed-in events carry the user id.
res = await fetch(`${APP}/api/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ name: 'map_view', path: '/en', locale: 'en' }),
})
ok('signed-in event → 204', res.status === 204)
const mine = await prisma.productEvent.findFirst({
  where: { userId: me.id, name: 'map_view' },
  orderBy: { createdAt: 'desc' },
})
ok('signed-in event stored with userId', !!mine && mine.locale === 'en' && mine.path === '/en')
const after = await prisma.productEvent.count()
ok('events persisted (4 rows)', after - before === 4, `${after - before}`)

// Rate limit (dev-only header override) — fresh bucket via a unique client IP.
const probeIp = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const codes = []
for (let i = 0; i < 3; i++) {
  const r = await postEvent({ name: 'news_view' }, { 'x-test-rate-limit': '2', 'x-forwarded-for': probeIp })
  codes.push(r.status)
}
ok('events rate limit → 429 after the cap', codes[0] === 204 && codes[1] === 204 && codes[2] === 429, codes.join(','))

// --- 2. board funnel tiles ---------------------------------------------------------
console.log('--- board ---')
await prisma.user.update({ where: { id: me.id }, data: { role: 'ADMIN' } })
res = await api('/api/admin/board')
ok('board → 200 for admin', res.status === 200)
const funnel = res.json?.funnel
const views = res.json?.viewsToday
ok(
  'board carries funnel (30d) counters',
  funnel && ['signups', 'briefReaders', 'alertCreators', 'paidCtaClicks', 'waitlist', 'inquiries'].every((k) => typeof funnel[k] === 'number'),
  JSON.stringify(funnel),
)
ok(
  'board carries today page-view counters',
  views && ['brief', 'news', 'map', 'reports', 'patterns', 'onchain', 'education'].every((k) => typeof views[k] === 'number'),
  JSON.stringify(views),
)
ok('board counted the brief view just sent', (views?.brief ?? 0) >= 1)
ok('board counted the paid CTA click', (funnel?.paidCtaClicks ?? 0) >= 1)
await prisma.user.update({ where: { id: me.id }, data: { role: 'USER' } })
res = await api('/api/admin/board')
ok('board → 403 for non-admin', res.status === 403)

// --- 3. per-plan limits ------------------------------------------------------------
console.log('--- plan limits ---')
res = await api('/api/me/entitlements')
ok('entitlements expose limits', res.json?.limits && typeof res.json.limits.watchlistItems !== 'undefined', JSON.stringify(res.json?.limits))

// Watchlist: FREE cap is 10.
await setPlan('FREE')
await prisma.watchlistItem.deleteMany({ where: { watchlist: { userId: me.id } } })
const syms = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'LTC']
const wl = []
for (const s of syms) {
  const r = await api('/api/me/watchlist', { method: 'POST', body: { symbol: s } })
  wl.push(r.status)
}
ok('FREE watchlist: 10 adds succeed', wl.slice(0, 10).every((c) => c === 200 || c === 201), wl.join(','))
ok('FREE watchlist: 11th add → 409 limit reached', wl[10] === 409)
res = await api('/api/me/watchlist', { method: 'POST', body: { symbol: 'UNI' } })
ok('409 body names the limit', res.json?.error === 'limit reached' && res.json?.key === 'watchlistItems' && res.json?.limit === 10 && res.json?.plan === 'FREE', JSON.stringify(res.json))
await setPlan('STARTER')
res = await api('/api/me/watchlist', { method: 'POST', body: { symbol: 'UNI' } })
ok('STARTER (25) accepts the 11th symbol', res.status === 200 || res.status === 201, String(res.status))
await prisma.watchlistItem.deleteMany({ where: { watchlist: { userId: me.id } } })

// Alert rules: TRADER cap 20, FREE has none.
await setPlan('FREE')
res = await api('/api/me/alerts', { method: 'POST', body: { type: 'PRICE', channel: 'INAPP', params: { symbol: 'BTC', direction: 'above', threshold: 1 } } })
ok('FREE cannot create alert rules (403)', res.status === 403)

// API keys: only WHALE, cap 5 active keys.
await setPlan('WHALE')
const before5 = await prisma.apiKey.findMany({ where: { userId: me.id, revokedAt: null }, select: { id: true } })
const created = []
for (let i = 0; i < 6; i++) {
  const r = await api('/api/me/api-keys', { method: 'POST', body: { name: `limit-test-${i}` } })
  created.push(r)
}
const keyCodes = created.map((r) => r.status)
const okCount = keyCodes.filter((c) => c === 200 || c === 201).length
ok('WHALE api keys: at most 5 active', okCount === Math.max(0, 5 - before5.length) && keyCodes.includes(409), keyCodes.join(','))
for (const r of created) {
  if (r.json?.id) await prisma.apiKey.deleteMany({ where: { id: r.json.id } })
}
await prisma.apiKey.deleteMany({ where: { userId: me.id, name: { startsWith: 'limit-test-' } } })

// --- cleanup -----------------------------------------------------------------------
await setPlan('FREE')
await prisma.productEvent.deleteMany({ where: { userId: me.id, name: 'map_view' } })
await prisma.$disconnect()
console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
