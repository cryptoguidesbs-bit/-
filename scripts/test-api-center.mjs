// Stage 18 — API Center test: Whale gating, key issue→call→usage
// aggregation E2E, disclaimer/terms on every API response, rate limiting,
// revocation/plan/region cuts, signed webhooks (verified with a local
// HTTP receiver).
import fs from 'node:fs'
import http from 'node:http'
import crypto from 'node:crypto'
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
const dbUser = await prisma.user.findFirst({ where: { email: EMAIL } })

async function setPlan(plan) {
  if (plan === 'FREE') {
    await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
    return
  }
  await prisma.subscription.upsert({
    where: { userId: dbUser.id },
    update: { plan, status: 'ACTIVE' },
    create: { userId: dbUser.id, plan, status: 'ACTIVE' },
  })
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
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) }
}
const v1 = (path, key, headers = {}) =>
  fetch(`${APP}${path}`, { headers: { authorization: `Bearer ${key}`, ...headers } }).then(
    async (res) => ({ status: res.status, headers: res.headers, json: await res.json().catch(() => null) }),
  )
const page = async (path, authed = false) => {
  const res = await fetch(`${APP}${path}`, {
    headers: authed ? { authorization: `Bearer ${jwt}` } : {},
  })
  return { status: res.status, html: await res.text() }
}

async function cleanup() {
  await prisma.apiKey.deleteMany({ where: { userId: dbUser.id } })
  await prisma.apiWebhook.deleteMany({ where: { userId: dbUser.id } })
  await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
}
await cleanup()

// --- 1. gating -----------------------------------------------------------------
console.log('--- gating ---')
let res = await api('/api/me/api-keys', { authed: false })
ok('signed-out → 401', res.status === 401)

await setPlan('TRADER')
res = await api('/api/me/api-keys')
ok('TRADER → 403 (Whale required)',
  res.status === 403 && res.json?.requiredPlan === 'WHALE')

const pageFree = await page('/ko/api-center', true)
ok('page below Whale → plan gate', pageFree.html.includes('data-testid="gate-plan"'))

await setPlan('WHALE')
res = await api('/api/me/api-keys')
ok('WHALE → key list ok', res.status === 200 && Array.isArray(res.json?.keys))

const pageWhale = await page('/ko/api-center', true)
ok('page WHALE → api center + terms',
  pageWhale.html.includes('data-testid="api-center-page"') &&
    pageWhale.html.includes('data-testid="api-center-terms"'))
ok('docs list the v1 endpoints', pageWhale.html.includes('/api/v1/market/prices'))

// --- 2. key issuance -------------------------------------------------------------
console.log('--- key issuance ---')
res = await api('/api/me/api-keys', { method: 'POST', body: { name: 'e2e-main' } })
const KEY = res.json?.key
ok('key issued (201, shown once)',
  res.status === 201 && KEY?.startsWith('cg_live_') && KEY.length > 40)

res = await api('/api/me/api-keys')
ok('list shows prefix only, never the full key',
  res.json?.keys?.[0]?.prefix?.includes('…') && !JSON.stringify(res.json).includes(KEY))

const extraKeys = []
for (let i = 0; i < 4; i++) {
  const r = await api('/api/me/api-keys', { method: 'POST', body: { name: `extra-${i}` } })
  extraKeys.push(r.json)
}
res = await api('/api/me/api-keys', { method: 'POST', body: { name: 'one-too-many' } })
ok('6th active key → 409 (limit 5)', res.status === 409)

// --- 3. authenticated API calls -----------------------------------------------------
console.log('--- v1 calls ---')
res = await v1('/api/v1/market/prices', '')
ok('missing key → 401', res.status === 401)
res = await v1('/api/v1/market/prices', 'cg_live_definitely_wrong')
ok('invalid key → 401', res.status === 401)

res = await v1('/api/v1/market/prices', KEY)
ok('prices with valid key → 200 + data', res.status === 200 && res.json?.data != null)
ok('response carries disclaimer + no-redistribution terms',
  res.json?.meta?.disclaimer?.ko?.includes('투자 권유가 아닙니다') &&
    res.json?.meta?.terms?.ko?.includes('재배포'))
ok('rate-limit headers present',
  res.headers.get('x-ratelimit-limit') != null && res.headers.get('x-ratelimit-remaining') != null)

res = await v1('/api/v1/market/sentiment', KEY)
ok('sentiment → 200 + meta', res.status === 200 && res.json?.meta?.terms?.en?.includes('Redistribution'))

res = await v1('/api/v1/briefs/latest', KEY)
ok('briefs/latest → 200 (AI label when present)',
  res.status === 200 &&
    res.json?.meta != null &&
    (res.json?.data == null || res.json?.data?.aiGenerated === true))

// Revocation cuts access.
const revokeTarget = extraKeys[0]
await api(`/api/me/api-keys/${revokeTarget.apiKey.id}`, { method: 'DELETE' })
res = await v1('/api/v1/market/prices', revokeTarget.key)
ok('revoked key → 401', res.status === 401)

// Plan lapse cuts access at call time.
await setPlan('TRADER')
res = await v1('/api/v1/market/prices', KEY)
ok('lapsed plan → 403', res.status === 403)
await setPlan('WHALE')

// Region policy applies to API calls.
res = await v1('/api/v1/market/prices', KEY, { 'x-vercel-ip-country': 'CN' })
ok('blocked region → 403', res.status === 403)

// --- 4. usage aggregation -------------------------------------------------------------
console.log('--- usage aggregation ---')
res = await api('/api/me/api-usage')
ok('usage total ≥ 3 across endpoints',
  res.status === 200 && res.json?.total >= 3, `total=${res.json?.total}`)
ok('per-endpoint aggregation present',
  (res.json?.byEndpoint?.['market/prices'] ?? 0) >= 1 &&
    (res.json?.byEndpoint?.['market/sentiment'] ?? 0) >= 1 &&
    (res.json?.byEndpoint?.['briefs/latest'] ?? 0) >= 1,
  JSON.stringify(res.json?.byEndpoint))
ok('rows carry UTC day buckets',
  res.json?.rows?.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day)))

const keyRow = await prisma.apiKey.findFirst({ where: { userId: dbUser.id, name: 'e2e-main' } })
ok('lastUsedAt stamped on the key', keyRow?.lastUsedAt != null)

// --- 5. rate limiting -------------------------------------------------------------------
console.log('--- rate limiting ---')
const rlRes = await api('/api/me/api-keys', { method: 'POST', body: { name: 'rl-test' } })
const RL_KEY = rlRes.json?.key
let last
for (let i = 0; i < 4; i++) {
  last = await v1('/api/v1/market/sentiment', RL_KEY, { 'x-test-rate-limit': '3' })
}
ok('4th call within window → 429', last.status === 429, `status=${last.status}`)
ok('429 carries Retry-After', Number(last.headers.get('retry-after')) > 0)

// --- 6. webhooks (signed, verified with a local receiver) --------------------------------
console.log('--- webhooks ---')
const received = []
const server = http.createServer((req, resp) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    received.push({ headers: req.headers, raw })
    resp.writeHead(200).end('ok')
  })
})
await new Promise((resolve) => server.listen(4599, '127.0.0.1', resolve))

res = await api('/api/me/webhooks', { method: 'POST', body: { url: 'not-a-url', events: ['test.ping'] } })
ok('invalid webhook url → 400', res.status === 400)

res = await api('/api/me/webhooks', {
  method: 'POST',
  body: { url: 'http://127.0.0.1:4599/hook', events: ['test.ping', 'brief.published'] },
})
const HOOK_ID = res.json?.webhook?.id
const HOOK_SECRET = res.json?.secret
ok('webhook registered + secret shown once',
  res.status === 201 && HOOK_SECRET?.startsWith('whsec_'))

res = await api(`/api/me/webhooks/${HOOK_ID}/test`, { method: 'POST' })
ok('test delivery reported ok', res.status === 200 && res.json?.ok === true)
const delivery = received[0]
ok('receiver got the delivery', received.length === 1 && delivery?.raw?.includes('test.ping'))
const expectedSig = `sha256=${crypto
  .createHmac('sha256', HOOK_SECRET)
  .update(delivery?.raw ?? '')
  .digest('hex')}`
ok('HMAC signature verifies', delivery?.headers['x-cryptoguide-signature'] === expectedSig)

res = await api('/api/me/webhooks')
ok('delivery status recorded', res.json?.webhooks?.[0]?.lastStatus === 200)

res = await api(`/api/me/webhooks/${HOOK_ID}`, { method: 'DELETE' })
ok('webhook deleted', res.status === 200)

server.close()

// --- cleanup ---------------------------------------------------------------------------------
await cleanup()
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
