// Stage 19 — Admin test: role gating, member/subscription management,
// revenue aggregation (USD), pipeline status, announcements, runtime region
// switches (immediate effect), compliance log viewers, Sentry report state,
// and the automated ops cycle (auto-expire → anomaly → admin alert → dedup
// → resolve → re-alert) that runs without operator intervention.
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
  return { status: res.status, json: await res.json().catch(() => null) }
}
const page = async (path, authed = false, headers = {}) => {
  const res = await fetch(`${APP}${path}`, {
    headers: { ...(authed ? { authorization: `Bearer ${jwt}` } : {}), ...headers },
  })
  return { status: res.status, html: await res.text() }
}

const fakeUsers = []
async function fakeUser(slug, subData) {
  const u = await prisma.user.create({
    data: { clerkId: `admfake_${slug}_${Date.now()}`, email: `admfake-${slug}-${Date.now()}@example.com` },
  })
  fakeUsers.push(u.id)
  if (subData) await prisma.subscription.create({ data: { userId: u.id, ...subData } })
  return u
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { contains: 'admfake-' } } })
  await prisma.opsEvent.deleteMany({})
  await prisma.featureSwitch.deleteMany({})
  await prisma.subscription.deleteMany({ where: { userId: me.id } })
  await prisma.notification.deleteMany({
    where: { OR: [{ title: { contains: '[운영 경보]' } }, { title: { contains: '관리자 테스트 공지' } }] },
  })
  await prisma.newsItem.deleteMany({ where: { urlHash: 'admintest-news' } })
  await prisma.apiKey.deleteMany({ where: { userId: me.id } })
}
await cleanup()

// Deterministic pipeline freshness for the monitor tests.
await prisma.newsItem.updateMany({ data: { ingestedAt: new Date() } })
const anyNews = await prisma.newsItem.count()
if (anyNews === 0) {
  await prisma.newsItem.create({
    data: {
      urlHash: 'admintest-news',
      title: 'admin test seed',
      url: 'https://example.com/admin-test',
      source: 'test',
      region: 'US',
      publishedAt: new Date(),
    },
  })
}
const anyBrief = await prisma.marketBrief.count({ where: { status: 'PUBLISHED' } })
if (anyBrief === 0) {
  await prisma.marketBrief.create({
    data: {
      briefDate: new Date().toISOString().slice(0, 10),
      tier: 'STANDARD',
      status: 'PUBLISHED',
      sections: {},
      aiModel: 'test-seed',
    },
  })
} else {
  await prisma.marketBrief.updateMany({
    where: { status: 'PUBLISHED' },
    data: { createdAt: new Date() },
  })
}

// --- 1. access control -----------------------------------------------------------
console.log('--- access control ---')
let res = await api('/api/admin/analytics', { authed: false })
ok('signed-out → 401', res.status === 401)

await prisma.user.update({ where: { id: me.id }, data: { role: 'USER' } })
res = await api('/api/admin/analytics')
ok('USER role → 403', res.status === 403)
let pg = await page('/ko/admin', true)
ok('page as USER → denied', pg.html.includes('data-testid="admin-denied"'))

await prisma.user.update({ where: { id: me.id }, data: { role: 'ADMIN' } })
res = await api('/api/admin/analytics')
ok('ADMIN → analytics ok', res.status === 200 && res.json?.users?.total >= 1)
pg = await page('/ko/admin', true)
ok('page as ADMIN → console renders', pg.html.includes('data-testid="admin-page"'))

// --- 2. member management ------------------------------------------------------------
console.log('--- members ---')
res = await api(`/api/admin/members?q=flowtest`)
ok('member search finds account', res.json?.members?.some((m) => m.email === EMAIL))
res = await api(`/api/admin/members?q=no-such-member-xyz`)
ok('empty search result', res.json?.members?.length === 0)

const target = await fakeUser('member')
res = await api(`/api/admin/members/${target.id}`, { method: 'PATCH', body: { plan: 'INSTITUTIONAL' } })
ok('manual plan override → ACTIVE subscription',
  res.json?.member?.subscription?.plan === 'INSTITUTIONAL' &&
    res.json?.member?.subscription?.status === 'ACTIVE')
res = await api(`/api/admin/members/${target.id}`, { method: 'PATCH', body: { role: 'ADMIN' } })
ok('role change applied', res.json?.member?.role === 'ADMIN')
await api(`/api/admin/members/${target.id}`, { method: 'PATCH', body: { role: 'USER', plan: 'FREE' } })

res = await api(`/api/admin/members/${me.id}`, { method: 'PATCH', body: { role: 'USER' } })
ok('self-demotion blocked', res.status === 400)

// --- 3. revenue aggregation ----------------------------------------------------------
console.log('--- revenue ---')
await fakeUser('rev1', { plan: 'STANDARD', status: 'ACTIVE', interval: 'MONTHLY' })
await fakeUser('rev2', { plan: 'STANDARD', status: 'ACTIVE', interval: 'MONTHLY' })
await fakeUser('rev3', { plan: 'PROFESSIONAL', status: 'ACTIVE', interval: 'MONTHLY' })
await fakeUser('rev4', { plan: 'INSTITUTIONAL', status: 'ACTIVE', interval: 'YEARLY' })

res = await api('/api/admin/revenue')
const expectedMrr = 199 + 199 + 499 + Math.round((14990 / 12) * 100) / 100
ok('MRR estimate from DB is exact (yearly prorated)',
  res.json?.mrrEstimate?.totalUsd === Math.round(expectedMrr * 100) / 100,
  `got=${res.json?.mrrEstimate?.totalUsd} want=${expectedMrr}`)
ok('per-plan breakdown', res.json?.mrrEstimate?.byPlan?.STANDARD?.count === 2)
ok('actuals unified by method (card/USDC, USD)',
  ['stripe', 'db-only'].includes(res.json?.source) &&
    typeof res.json?.actuals?.byMethod?.card === 'number' &&
    typeof res.json?.actuals?.byMethod?.usdc === 'number',
  `source=${res.json?.source}`)

// --- 4. pipelines ----------------------------------------------------------------------
console.log('--- pipelines ---')
res = await api('/api/admin/pipelines')
ok('pipeline health snapshot',
  res.status === 200 &&
    'news' in (res.json ?? {}) && 'brief' in res.json && 'report' in res.json && 'ai' in res.json)

// --- 5. announcements ---------------------------------------------------------------------
console.log('--- announcements ---')
const userCount = await prisma.user.count()
res = await api('/api/admin/announce', {
  method: 'POST',
  body: { title: '관리자 테스트 공지', body: '점검 안내' },
})
ok('broadcast sent to every member', res.json?.sent === userCount, `sent=${res.json?.sent}/${userCount}`)
const gotAnnounce = await prisma.notification.findFirst({
  where: { userId: me.id, title: '관리자 테스트 공지' },
})
ok('announcement landed in my notifications', gotAnnounce != null)

// --- 6. region switches (즉시 반영) ---------------------------------------------------------
console.log('--- region switches ---')
const ent = () => api('/api/me/entitlements').then((r) => r.json?.features?.['onchain.advanced'])
const entWith = (country) =>
  api('/api/me/entitlements', { headers: { 'x-vercel-ip-country': country } }).then(
    (r) => r.json?.features?.['onchain.advanced'],
  )

ok('baseline: onchain allowed', (await ent())?.allowed === true)

res = await api('/api/admin/region-switches', {
  method: 'PUT',
  body: { feature: 'onchain.advanced', enabled: false },
})
ok('kill switch saved', res.status === 200)
let f = await ent()
ok('OFF → blocked everywhere immediately (region reason)',
  f?.allowed === false && f?.reason === 'region')
pg = await page('/ko/onchain', true)
ok('page shows region gate', pg.html.includes('data-testid="gate-region"'))

await api('/api/admin/region-switches', {
  method: 'PUT',
  body: { feature: 'onchain.advanced', enabled: true, whitelist: ['US'], allowUnknown: false },
})
ok('whitelist override: KR blocked', (await entWith('KR'))?.allowed === false)
ok('whitelist override: US allowed', (await entWith('US'))?.allowed === true)
ok('allowUnknown=false: no-geo blocked', (await ent())?.allowed === false)

await api('/api/admin/region-switches', { method: 'DELETE', body: { feature: 'onchain.advanced' } })
ok('reset → config policy applies again', (await ent())?.allowed === true)

// Kill switch also cuts the public v1 API instantly.
const keyRes = await api('/api/me/api-keys', { method: 'POST', body: { name: 'admin-e2e' } })
const API_KEY = keyRes.json?.key
const v1 = (headers = {}) =>
  fetch(`${APP}/api/v1/market/sentiment`, {
    headers: { authorization: `Bearer ${API_KEY}`, ...headers },
  }).then((r) => r.status)
ok('v1 baseline 200', (await v1()) === 200)
await api('/api/admin/region-switches', {
  method: 'PUT',
  body: { feature: 'api.center', enabled: false },
})
ok('api.center OFF → v1 blocked immediately', (await v1()) === 403)
await api('/api/admin/region-switches', { method: 'DELETE', body: { feature: 'api.center' } })
ok('api.center reset → v1 restored', (await v1()) === 200)

// --- 7. compliance log viewers -----------------------------------------------------------------
console.log('--- logs ---')
res = await api('/api/admin/logs?type=audit')
ok('audit log rows', res.status === 200 && Array.isArray(res.json?.rows) &&
  (res.json.rows.length === 0 || res.json.rows[0].action != null))
res = await api('/api/admin/logs?type=consent')
ok('consent log rows carry version + user',
  res.status === 200 && res.json?.rows?.length >= 1 &&
    res.json.rows[0].version != null && res.json.rows[0].user?.email != null)
res = await api('/api/admin/logs?type=bogus')
ok('invalid log type → 400', res.status === 400)

res = await api('/api/admin/errors')
ok('Sentry report state (unconfigured dev fallback)',
  res.status === 200 && ['unconfigured', 'sentry', 'error'].includes(res.json?.source) &&
    Array.isArray(res.json?.issues))

// --- 8. automated ops cycle (완료 조건) -------------------------------------------------------
console.log('--- automated ops cycle ---')
res = await api('/api/admin/monitor/run', { method: 'POST', authed: false, headers: { origin: APP } })
ok('monitor without auth → 401', res.status === 401)

// 8a. subscription hygiene: PAST_DUE past grace auto-expires; within grace stays.
const oldDue = await fakeUser('olddue', {
  plan: 'STANDARD', status: 'PAST_DUE', currentPeriodEnd: new Date(Date.now() - 20 * 86_400_000),
})
const recentDue = await fakeUser('recentdue', {
  plan: 'STANDARD', status: 'PAST_DUE', currentPeriodEnd: new Date(Date.now() - 2 * 86_400_000),
})
res = await api('/api/admin/monitor/run', { method: 'POST' })
const run1 = res.json?.summary
const oldSub = await prisma.subscription.findUnique({ where: { userId: oldDue.id } })
const recentSub = await prisma.subscription.findUnique({ where: { userId: recentDue.id } })
ok('grace exceeded → auto-EXPIRED', run1?.expiredSubscriptions >= 1 && oldSub?.status === 'EXPIRED')
ok('within grace → untouched (PAST_DUE)', recentSub?.status === 'PAST_DUE')
ok('below threshold → no payment anomaly', !run1?.eventsRaised?.includes('anomaly.payment_failures'),
  JSON.stringify(run1))

// 8b. anomaly detection + auto admin alert.
for (let i = 0; i < 4; i++) {
  await fakeUser(`due${i}`, {
    plan: 'STANDARD', status: 'PAST_DUE', currentPeriodEnd: new Date(Date.now() + 86_400_000),
  })
}
res = await api('/api/admin/monitor/run', { method: 'POST' })
const run2 = res.json?.summary
ok('failure spike → anomaly raised', run2?.eventsRaised?.includes('anomaly.payment_failures'),
  JSON.stringify(run2))
const opsEvent = await prisma.opsEvent.findFirst({
  where: { kind: 'anomaly.payment_failures', resolvedAt: null },
})
ok('OpsEvent recorded (critical)', opsEvent?.severity === 'critical')
const alertNotif = await prisma.notification.findFirst({
  where: { userId: me.id, title: { contains: '[운영 경보] anomaly.payment_failures' } },
})
ok('admin auto-notified in-app', alertNotif != null)

// 8c. dedup while unresolved.
res = await api('/api/admin/monitor/run', { method: 'POST' })
ok('unresolved anomaly deduplicated',
  res.json?.summary?.eventsSuppressed?.includes('anomaly.payment_failures'))
const openCount = await prisma.opsEvent.count({
  where: { kind: 'anomaly.payment_failures', resolvedAt: null },
})
ok('still exactly one open event', openCount === 1)

// 8d. resolve → cycle re-arms automatically.
res = await api(`/api/admin/ops-events/${opsEvent.id}`, { method: 'PATCH' })
ok('event resolved', res.status === 200)
res = await api('/api/admin/monitor/run', { method: 'POST' })
ok('after resolve, persisting anomaly re-alerts',
  res.json?.summary?.eventsRaised?.includes('anomaly.payment_failures'))

// 8e. stale pipeline detection.
await prisma.newsItem.updateMany({ data: { ingestedAt: new Date(Date.now() - 3 * 86_400_000) } })
res = await api('/api/admin/monitor/run', { method: 'POST' })
ok('stale news pipeline detected', res.json?.summary?.eventsRaised?.includes('anomaly.news_stale'),
  JSON.stringify(res.json?.summary))
await prisma.newsItem.updateMany({ data: { ingestedAt: new Date() } })

// --- cleanup ------------------------------------------------------------------------------------
await cleanup()
await prisma.user.update({ where: { id: me.id }, data: { role: 'USER' } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
