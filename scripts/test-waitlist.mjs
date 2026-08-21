// Free-first launch waitlist test.
//  1. POST /api/waitlist stores a signup, dedupes by email (upsert), validates
//     input and rate limits abuse.
//  2. The checkout API refuses to create sessions in waitlist mode (via the
//     non-production x-test-payments-mode hook — production uses the
//     NEXT_PUBLIC_PAYMENTS_MODE env flag).
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

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

const MARK = `wl-${Date.now()}`
// Per-run IP so the limiter bucket is fresh on every run.
const RUN_IP = `203.0.113.${Math.floor(Math.random() * 200) + 1}`

const post = (body, headers = {}) =>
  fetch(`${APP}/api/waitlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': RUN_IP, ...headers },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))

// --- 1. waitlist API -------------------------------------------------------------
console.log('--- waitlist API ---')
let res = await post({ email: `${MARK}@example.com`, plan: 'trader', locale: 'ko' })
ok('signup accepted', res.status === 201 && res.json?.ok === true, `status=${res.status}`)

let row = await prisma.waitlistSignup.findUnique({ where: { email: `${MARK}@example.com` } })
ok('signup stored (plan + locale)', row?.plan === 'trader' && row?.locale === 'ko',
  JSON.stringify(row && { plan: row.plan, locale: row.locale }))

// Same email again with a different plan → upsert, not a duplicate.
res = await post({ email: `${MARK}@example.com`, plan: 'whale', locale: 'en' })
const count = await prisma.waitlistSignup.count({ where: { email: `${MARK}@example.com` } })
row = await prisma.waitlistSignup.findUnique({ where: { email: `${MARK}@example.com` } })
ok('repeat submit upserts (1 row, latest plan)',
  res.status === 201 && count === 1 && row?.plan === 'whale', `count=${count} plan=${row?.plan}`)

// Unknown plan value is stored as null rather than rejected.
res = await post({ email: `null-${MARK}@example.com`, plan: 'not-a-plan' })
row = await prisma.waitlistSignup.findUnique({ where: { email: `null-${MARK}@example.com` } })
ok('unknown plan → null (signup still accepted)', res.status === 201 && row?.plan === null)

res = await post({ email: 'not-an-email' })
ok('invalid email rejected', res.status === 400, `status=${res.status}`)

const rlIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`
await post({ email: `rl-${MARK}@example.com` }, { 'x-test-rate-limit': '1', 'x-forwarded-for': rlIp })
res = await post({ email: `rl2-${MARK}@example.com` }, { 'x-test-rate-limit': '1', 'x-forwarded-for': rlIp })
ok('rate limit enforced (429)', res.status === 429, `status=${res.status}`)

// --- 2. checkout is blocked in waitlist mode -------------------------------------
console.log('--- checkout blocked in waitlist mode ---')
async function clerkApi(path, method = 'GET', body) {
  const r = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return r.json().catch(() => null)
}
const users = await clerkApi(`/users?email_address=${encodeURIComponent(EMAIL)}`)
const session = await clerkApi('/sessions', 'POST', { user_id: users?.[0]?.id })
const tok = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', { expires_in_seconds: 600 })
const jwt = tok?.jwt

const checkout = await fetch(`${APP}/api/billing/checkout`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${jwt}`,
    'content-type': 'application/json',
    origin: APP,
    'x-test-payments-mode': 'waitlist',
  },
  body: JSON.stringify({ plan: 'starter', interval: 'monthly', locale: 'ko' }),
})
const checkoutJson = await checkout.json().catch(() => null)
ok('checkout returns 403 WAITLIST in waitlist mode',
  checkout.status === 403 && checkoutJson?.code === 'WAITLIST',
  `status=${checkout.status} code=${checkoutJson?.code}`)

// Same request without the flag still works (live mode default in dev).
const live = await fetch(`${APP}/api/billing/checkout`, {
  method: 'POST',
  headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json', origin: APP },
  body: JSON.stringify({ plan: 'starter', interval: 'monthly', locale: 'ko' }),
})
ok('live mode unaffected (checkout still creates or 409s)',
  live.status === 200 || live.status === 409, `status=${live.status}`)
if (live.status === 200) {
  const j = await live.json().catch(() => null)
  if (j?.id) {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    await stripe.checkout.sessions.expire(j.id).catch(() => {})
  }
}

// --- cleanup ---------------------------------------------------------------------
await prisma.waitlistSignup.deleteMany({ where: { email: { contains: MARK } } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed — ${fail === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(fail === 0 ? 0 : 1)
