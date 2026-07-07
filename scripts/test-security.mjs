// Stage 21 — Security checklist test. Verifies webhook signature
// verification (Stripe + Clerk/svix), RBAC, rate limiting, CSRF origin
// checks, input validation, secure headers, audit logging, and the GDPR
// endpoints (data export / right to erasure / data minimization).
import fs from 'node:fs'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { Webhook } from 'svix'

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
const ORIGIN = APP
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
    headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json().catch(() => null)
}
const users = await clerkApi(`/users?email_address=${encodeURIComponent(EMAIL)}`)
const session = await clerkApi('/sessions', 'POST', { user_id: users?.[0]?.id })
const tokenRes = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', { expires_in_seconds: 600 })
const jwt = tokenRes?.jwt
const me = await prisma.user.findFirst({ where: { email: EMAIL } })

async function setPlan(plan) {
  if (plan === 'FREE') return prisma.subscription.deleteMany({ where: { userId: me.id } })
  return prisma.subscription.upsert({
    where: { userId: me.id },
    update: { plan, status: 'ACTIVE' },
    create: { userId: me.id, plan, status: 'ACTIVE' },
  })
}

// Bearer-token requests are CSRF-exempt (not cookie auth).
const api = async (path, { method = 'GET', body, authed = true, headers = {} } = {}) => {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: {
      ...(authed && jwt ? { authorization: `Bearer ${jwt}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) }
}

async function cleanup() {
  await prisma.securityEvent.deleteMany({ where: { OR: [{ userId: me.id }, { actorEmail: { contains: 'secfake-' } }] } })
  await prisma.user.deleteMany({ where: { email: { contains: 'secfake-' } } })
  await prisma.subscription.deleteMany({ where: { userId: me.id } })
  await prisma.apiKey.deleteMany({ where: { userId: me.id } })
}
await cleanup()

// --- 1. secure headers ---------------------------------------------------------
console.log('--- secure headers ---')
const h = await api('/ko', { authed: false })
ok('X-Content-Type-Options nosniff', h.headers.get('x-content-type-options') === 'nosniff')
ok('X-Frame-Options SAMEORIGIN', h.headers.get('x-frame-options') === 'SAMEORIGIN')
ok('Referrer-Policy set', (h.headers.get('referrer-policy') ?? '').includes('strict-origin'))
ok('HSTS present', (h.headers.get('strict-transport-security') ?? '').includes('max-age='))
ok('Permissions-Policy present', (h.headers.get('permissions-policy') ?? '').includes('geolocation=()'))
ok('CSP frame-ancestors/base-uri', (h.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'self'"))
ok('X-Powered-By removed', !h.headers.get('x-powered-by'))

// --- 2. webhook signature verification ------------------------------------------
console.log('--- webhook verification ---')
// Stripe: unsigned body rejected.
let res = await fetch(`${APP}/api/billing/webhook`, { method: 'POST', body: '{}' })
ok('stripe webhook: missing signature → 400', res.status === 400)
res = await fetch(`${APP}/api/billing/webhook`, {
  method: 'POST',
  headers: { 'stripe-signature': 't=1,v1=deadbeef' },
  body: '{"id":"evt_1"}',
})
ok('stripe webhook: bad signature → 400', res.status === 400)

// Clerk (svix): bad signature rejected, valid signature accepted.
res = await fetch(`${APP}/api/webhooks/clerk`, {
  method: 'POST',
  headers: { 'svix-id': 'msg_1', 'svix-timestamp': `${Math.floor(Date.now() / 1000)}`, 'svix-signature': 'v1,bad' },
  body: '{"type":"user.updated","data":{"id":"x"}}',
})
ok('clerk webhook: bad signature → 400', res.status === 400)

// Valid svix signature for a user.deleted of a throwaway user.
const secfake = await prisma.user.create({
  data: { clerkId: `secfake_del_${Date.now()}`, email: `secfake-del-${Date.now()}@example.com` },
})
const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET)
const svixId = `msg_${crypto.randomBytes(6).toString('hex')}`
const svixTs = `${Math.floor(Date.now() / 1000)}`
const payload = JSON.stringify({ type: 'user.deleted', data: { id: secfake.clerkId } })
const signature = wh.sign(svixId, new Date(Number(svixTs) * 1000), payload)
res = await fetch(`${APP}/api/webhooks/clerk`, {
  method: 'POST',
  headers: { 'svix-id': svixId, 'svix-timestamp': svixTs, 'svix-signature': signature, 'content-type': 'application/json' },
  body: payload,
})
const deletedRow = await prisma.user.findUnique({ where: { id: secfake.id } })
ok('clerk webhook: valid signature → user.deleted cascades', res.status === 200 && deletedRow === null)

// --- 3. RBAC -------------------------------------------------------------------
console.log('--- RBAC ---')
await prisma.user.update({ where: { id: me.id }, data: { role: 'USER' } })
res = await api('/api/admin/analytics')
ok('non-admin → admin API 403', res.status === 403)
await setPlan('FREE')
res = await api('/api/me/api-keys', { method: 'POST', body: { name: 'x' }, headers: { origin: ORIGIN } })
ok('FREE → api.center 403 (plan RBAC)', res.status === 403)
res = await api('/api/v1/market/prices', { authed: false, headers: { authorization: 'Bearer cg_live_bogus' } })
ok('invalid API key → 401', res.status === 401)

// --- 4. CSRF (cookie-auth mutations) --------------------------------------------
console.log('--- CSRF ---')
// Simulate a cookie-authed request (no Bearer) with a foreign Origin.
res = await fetch(`${APP}/api/me/watchlist`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://evil.example', cookie: '__session=x' },
  body: JSON.stringify({ symbol: 'BTC' }),
})
ok('cross-origin cookie mutation → 403', res.status === 403)
res = await fetch(`${APP}/api/me/watchlist`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: '__session=x' },
  body: JSON.stringify({ symbol: 'BTC' }),
})
ok('missing Origin cookie mutation → 403', res.status === 403)
// Bearer requests are CSRF-exempt: reach the handler (401 from Clerk verify, not 403).
res = await api('/api/me/watchlist', { method: 'POST', body: { symbol: 'BTC' }, authed: false, headers: { authorization: 'Bearer bogus.jwt.token' } })
ok('bearer mutation is CSRF-exempt (not 403)', res.status !== 403)
// GET is never CSRF-blocked.
res = await fetch(`${APP}/api/me/entitlements`, { headers: { origin: 'https://evil.example' } })
ok('cross-origin GET not blocked', res.status !== 403)

// --- 5. input validation --------------------------------------------------------
console.log('--- input validation ---')
await prisma.user.update({ where: { id: me.id }, data: { role: 'ADMIN' } })
res = await api('/api/me/watchlist', { method: 'POST', body: { symbol: '"><script>' }, headers: { origin: ORIGIN } })
ok('invalid symbol (injection chars) → 400', res.status === 400)
res = await api('/api/me/alerts', {
  method: 'POST',
  body: { type: 'PRICE', channel: 'INAPP', params: { symbol: 'BTC', direction: 'sideways', threshold: 1 } },
  headers: { origin: ORIGIN },
})
await setPlan('PROFESSIONAL')
res = await api('/api/me/alerts', {
  method: 'POST',
  body: { type: 'PRICE', channel: 'INAPP', params: { symbol: 'BTC', direction: 'sideways', threshold: 1 } },
  headers: { origin: ORIGIN },
})
ok('invalid enum value → 400', res.status === 400)

// --- 6. rate limiting -----------------------------------------------------------
console.log('--- rate limiting ---')
let last
for (let i = 0; i < 4; i++) {
  last = await api('/api/me/export', { headers: { origin: ORIGIN, 'x-test-rate-limit': '3' } })
}
ok('export rate limit → 429 + Retry-After', last.status === 429 && Number(last.headers.get('retry-after')) > 0)

// --- 7. GDPR: data export (portability + minimization) --------------------------
console.log('--- GDPR export ---')
res = await api('/api/me/export')
ok('export returns account bundle', res.status === 200 && res.json?.account?.email === EMAIL)
ok('export includes subscription + consent history',
  'subscription' in (res.json ?? {}) && Array.isArray(res.json?.consentLogs))
const raw = JSON.stringify(res.json ?? {})
ok('minimization: no key hashes / signing secrets in export',
  !raw.includes('keyHash') && !/whsec_/.test(raw) && !/"secret"/.test(raw))
ok('export API keys carry prefix only, not the full key',
  (res.json?.apiKeys ?? []).every((k) => !k.keyHash && (k.prefix === undefined || String(k.prefix).includes('…')) || res.json.apiKeys.length === 0))

// --- 8. audit logging -----------------------------------------------------------
console.log('--- audit logging ---')
const exportEvent = await prisma.securityEvent.findFirst({
  where: { userId: me.id, action: 'data.export' },
  orderBy: { createdAt: 'desc' },
})
ok('data.export is security-audited (with IP/actor)', exportEvent != null && exportEvent.actorEmail === EMAIL)

// admin action audited
res = await api(`/api/admin/region-switches`, {
  method: 'PUT',
  body: { feature: 'onchain.advanced', enabled: false },
  headers: { origin: ORIGIN },
})
const switchEvent = await prisma.securityEvent.findFirst({ where: { action: 'admin.region_switch.set' }, orderBy: { createdAt: 'desc' } })
ok('admin region switch is security-audited', res.status === 200 && switchEvent != null)
await api(`/api/admin/region-switches`, { method: 'DELETE', body: { feature: 'onchain.advanced' }, headers: { origin: ORIGIN } })

// --- 9. GDPR: right to erasure --------------------------------------------------
console.log('--- GDPR erasure ---')
// Build a disposable signed-in user via Clerk, then delete via the endpoint.
const delEmail = `secfake-erase-${Date.now()}+clerk_test@example.com`
const delClerk = await clerkApi('/users', 'POST', {
  email_address: [delEmail],
  password: `SecErase!${crypto.randomBytes(4).toString('hex')}`,
})
const delJwtSession = await clerkApi('/sessions', 'POST', { user_id: delClerk.id })
const delTok = await clerkApi(`/sessions/${delJwtSession?.id}/tokens`, 'POST', { expires_in_seconds: 300 })
const delJwt = delTok?.jwt
// Materialize the DB row (consent) + a portfolio to prove cascade.
await fetch(`${APP}/api/consent`, {
  method: 'POST',
  headers: { authorization: `Bearer ${delJwt}`, 'content-type': 'application/json' },
  body: JSON.stringify({ locale: 'ko' }),
})
const delUser = await prisma.user.findFirst({ where: { email: delEmail } })
await prisma.portfolio.create({ data: { userId: delUser.id, name: 'temp' } })

// Wrong confirmation → 400.
res = await fetch(`${APP}/api/me/account`, {
  method: 'DELETE',
  headers: { authorization: `Bearer ${delJwt}`, 'content-type': 'application/json' },
  body: JSON.stringify({ confirm: 'nope' }),
})
ok('erasure without confirmation → 400', res.status === 400)

res = await fetch(`${APP}/api/me/account`, {
  method: 'DELETE',
  headers: { authorization: `Bearer ${delJwt}`, 'content-type': 'application/json' },
  body: JSON.stringify({ confirm: 'DELETE' }),
})
const goneUser = await prisma.user.findFirst({ where: { email: delEmail } })
const gonePortfolios = await prisma.portfolio.count({ where: { userId: delUser.id } })
ok('erasure deletes the account', res.status === 200 && goneUser === null)
ok('erasure cascades related data (portfolio gone)', gonePortfolios === 0)
const eraseAudit = await prisma.securityEvent.findFirst({
  where: { action: 'account.deleted.self', actorEmail: delEmail },
})
ok('erasure is audited (actor retained, userId nulled)', eraseAudit != null && eraseAudit.userId === null)
const clerkGone = await clerkApi(`/users/${delClerk.id}`)
ok('erasure removes the Clerk identity too', clerkGone?.error || clerkGone?.errors || !clerkGone?.id)

// --- cleanup --------------------------------------------------------------------
await cleanup()
await prisma.user.update({ where: { id: me.id }, data: { role: 'USER' } })
await prisma.securityEvent.deleteMany({ where: { actorEmail: { contains: 'secfake-erase' } } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
