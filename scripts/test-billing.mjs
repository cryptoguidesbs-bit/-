// Stage 5 billing flow E2E test (API level).
// 1) checkout route returns a Stripe URL for an authed user
// 2) webhook (signed) creates the Subscription row
// 3) cancel route sets cancel_at_period_end in Stripe and the DB
import fs from 'node:fs'
import Stripe from 'stripe'
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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const prisma = new PrismaClient()
const results = []
const ok = (name, pass, detail = '') => {
  results.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

// --- auth: Clerk session token for the flowtest user ----------------------
async function clerkApi(path, method = 'GET', body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const users = await clerkApi(`/users?email_address=${encodeURIComponent(EMAIL)}`)
const clerkUserId = users.json?.[0]?.id
const session = await clerkApi('/sessions', 'POST', { user_id: clerkUserId })
const tokenRes = await clerkApi(`/sessions/${session.json?.id}/tokens`, 'POST', {
  expires_in_seconds: 600,
})
const jwt = tokenRes.json?.jwt
console.log('auth ready:', !!jwt)

const dbUser = await prisma.user.findFirst({ where: { email: EMAIL } })
console.log('db user:', dbUser?.id)

// Clean slate for repeatable runs.
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })

// --- 1. checkout route -----------------------------------------------------
const checkout = await fetch(`${APP}/api/billing/checkout`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ plan: 'standard', interval: 'yearly', locale: 'ko' }),
})
const checkoutJson = await checkout.json().catch(() => null)
ok(
  'checkout route returns Stripe URL',
  checkout.status === 200 && checkoutJson?.url?.startsWith('https://checkout.stripe.com'),
  `status=${checkout.status}`,
)
if (checkoutJson?.id) await stripe.checkout.sessions.expire(checkoutJson.id).catch(() => {})

// unauthenticated → 401 (same-origin so the CSRF layer passes and we
// exercise the auth check itself)
const noAuth = await fetch(`${APP}/api/billing/checkout`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: APP },
  body: JSON.stringify({ plan: 'standard', interval: 'monthly', locale: 'ko' }),
})
ok('checkout requires auth', noAuth.status === 401, `status=${noAuth.status}`)

// --- 2. real subscription + signed webhook --------------------------------
const customer = await stripe.customers.create({
  email: EMAIL,
  payment_method: 'pm_card_visa',
  invoice_settings: { default_payment_method: 'pm_card_visa' },
  metadata: { userId: dbUser.id },
})
const sub = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: process.env.STRIPE_PRICE_STANDARD_MONTHLY }],
  metadata: { userId: dbUser.id, plan: 'standard', interval: 'monthly' },
})
ok('stripe subscription created', sub.status === 'active', `status=${sub.status} id=${sub.id}`)

const payload = JSON.stringify({
  id: 'evt_test_created',
  object: 'event',
  api_version: '2normalize',
  type: 'customer.subscription.created',
  data: { object: sub },
})
const header = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: process.env.STRIPE_WEBHOOK_SECRET,
})
const hook = await fetch(`${APP}/api/billing/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': header },
  body: payload,
})
ok('webhook accepted (signed)', hook.status === 200, `status=${hook.status}`)

// bad signature must be rejected
const badHook = await fetch(`${APP}/api/billing/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
  body: payload,
})
ok('webhook rejects bad signature', badHook.status === 400, `status=${badHook.status}`)

let row = await prisma.subscription.findUnique({ where: { userId: dbUser.id } })
ok(
  'DB subscription row synced',
  row?.plan === 'STANDARD' && row?.status === 'ACTIVE' && row?.interval === 'MONTHLY' && row?.externalId === sub.id,
  `plan=${row?.plan} status=${row?.status} interval=${row?.interval}`,
)

// --- 3. cancel route --------------------------------------------------------
const cancel = await fetch(`${APP}/api/billing/cancel`, {
  method: 'POST',
  headers: { authorization: `Bearer ${jwt}` },
})
const cancelJson = await cancel.json().catch(() => null)
row = await prisma.subscription.findUnique({ where: { userId: dbUser.id } })
const stripeSub = await stripe.subscriptions.retrieve(sub.id)
ok(
  'cancel route (at period end)',
  cancel.status === 200 &&
    cancelJson?.cancelAtPeriodEnd === true &&
    row?.cancelAtPeriodEnd === true &&
    stripeSub.cancel_at_period_end === true,
  `status=${cancel.status} db=${row?.cancelAtPeriodEnd} stripe=${stripeSub.cancel_at_period_end}`,
)

// --- 4. subscription.deleted webhook → status CANCELED ---------------------
const deletedPayload = JSON.stringify({
  id: 'evt_test_deleted',
  object: 'event',
  type: 'customer.subscription.deleted',
  data: { object: { ...stripeSub, status: 'canceled' } },
})
const deletedHeader = stripe.webhooks.generateTestHeaderString({
  payload: deletedPayload,
  secret: process.env.STRIPE_WEBHOOK_SECRET,
})
const hookDeleted = await fetch(`${APP}/api/billing/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': deletedHeader },
  body: deletedPayload,
})
row = await prisma.subscription.findUnique({ where: { userId: dbUser.id } })
ok(
  'deleted webhook → CANCELED in DB',
  hookDeleted.status === 200 && row?.status === 'CANCELED',
  `status=${row?.status}`,
)

// --- cleanup ----------------------------------------------------------------
await stripe.subscriptions.cancel(sub.id).catch(() => {})
await stripe.customers.del(customer.id).catch(() => {})
await prisma.$disconnect()

console.log('\nSUMMARY:', results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED')
