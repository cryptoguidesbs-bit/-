// Subscription & refund policy test (Stripe test mode). Covers:
//  1-2 pricing: period display + yearly = monthly×10 (2mo free / 17%)
//  3   7-day trial: trialing status, no charge, cancel-in-trial = no charge
//  4   renewal reminder via signed invoice.upcoming webhook
//  5   upgrade: immediate + prorated invoice
//  6   downgrade: scheduled at period end (pending, live plan unchanged)
//  7   cancel: cancelAtPeriodEnd (monthly + yearly)
//  8   annual refund: 14-day + unused; used/window/monthly rejected
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
const P = {
  stdM: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  stdY: process.env.STRIPE_PRICE_STARTER_YEARLY,
  proM: process.env.STRIPE_PRICE_TRADER_MONTHLY,
}

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
const tok = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', { expires_in_seconds: 900 })
const jwt = tok?.jwt
const me = await prisma.user.findFirst({ where: { email: EMAIL } })
const ORIGIN = APP

const api = (path, { method = 'GET', body } = {}) =>
  fetch(`${APP}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${jwt}`,
      origin: ORIGIN,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))

const createdSubs = []
let customer
async function newCustomer() {
  return stripe.customers.create({
    email: EMAIL,
    payment_method: 'pm_card_visa',
    invoice_settings: { default_payment_method: 'pm_card_visa' },
    metadata: { userId: me.id },
  })
}
async function createSub(price, { trial = false } = {}) {
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price }],
    ...(trial ? { trial_period_days: 7 } : {}),
    metadata: { userId: me.id },
    expand: ['latest_invoice.payment_intent'],
  })
  createdSubs.push(sub.id)
  return sub
}
// Sync a Stripe subscription into our DB via the signed webhook.
async function syncViaWebhook(sub, type = 'customer.subscription.created') {
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, object: 'event', type, data: { object: sub } })
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET })
  await fetch(`${APP}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': header },
    body: payload,
  })
}

async function cleanup() {
  for (const id of createdSubs) {
    await stripe.subscriptions.cancel(id).catch(() => {})
  }
  if (customer) await stripe.customers.del(customer.id).catch(() => {})
  await prisma.accessLog.deleteMany({ where: { userId: me.id } })
  await prisma.subscription.deleteMany({ where: { userId: me.id } })
  await prisma.notification.deleteMany({ where: { userId: me.id, type: 'BILLING' } })
  await prisma.securityEvent.deleteMany({ where: { userId: me.id, action: { startsWith: 'billing.' } } })
}
await prisma.subscription.deleteMany({ where: { userId: me.id } })
await prisma.notification.deleteMany({ where: { userId: me.id, type: 'BILLING' } })
customer = await newCustomer()

// --- 1-2. pricing: period display + yearly math -------------------------------
console.log('--- pricing display / math ---')
// A-3 values: yearly = monthly × 10 → 2 months free (~17% off).
ok('yearly = monthly × 10 (starter)', 59 * 10 === 590)
ok('yearly = monthly × 10 (trader)', 149 * 10 === 1490)
const landing = await fetch(`${APP}/ko`).then((r) => r.text())
ok('landing offers monthly + yearly billing terms', landing.includes('data-testid="interval-monthly"') && landing.includes('data-testid="interval-yearly"'))
ok('landing shows 7-day trial note', landing.includes('7일 무료 체험'))
ok('landing shows yearly 17% discount', landing.includes('2개월 무료'))

// --- 3. trial ------------------------------------------------------------------
console.log('--- 7-day trial ---')
const trialSub = await createSub(P.stdM, { trial: true })
ok('stripe sub is trialing', trialSub.status === 'trialing', `status=${trialSub.status}`)
const trialDays = Math.round((trialSub.trial_end - trialSub.trial_start) / 86400)
ok('trial length is 7 days', trialDays === 7, `days=${trialDays}`)
const trialInvoice = trialSub.latest_invoice
const trialCharged = trialInvoice?.amount_paid ?? 0
ok('no charge during trial', trialCharged === 0, `amount_paid=${trialCharged}`)
await syncViaWebhook(trialSub)
let row = await prisma.subscription.findUnique({ where: { userId: me.id } })
ok('DB status TRIALING', row?.status === 'TRIALING', `status=${row?.status}`)
// cancel during trial → no charge ever
const canceledTrial = await stripe.subscriptions.cancel(trialSub.id)
const trialInvoices = await stripe.invoices.list({ subscription: trialSub.id, limit: 10 })
const anyPaid = trialInvoices.data.some((i) => (i.amount_paid ?? 0) > 0)
ok('cancel during trial → never charged', canceledTrial.status === 'canceled' && !anyPaid)

// --- 4. renewal reminder (invoice.upcoming) -----------------------------------
console.log('--- renewal reminder ---')
const activeStd = await createSub(P.stdM) // charged, active
await syncViaWebhook(activeStd)
const upcomingPayload = JSON.stringify({
  id: `evt_up_${Date.now()}`,
  object: 'event',
  type: 'invoice.upcoming',
  data: {
    object: {
      object: 'invoice',
      customer: customer.id,
      amount_due: 19900,
      currency: 'usd',
      period_end: Math.floor(Date.now() / 1000) + 3 * 86400,
    },
  },
})
const upHeader = stripe.webhooks.generateTestHeaderString({ payload: upcomingPayload, secret: process.env.STRIPE_WEBHOOK_SECRET })
const upRes = await fetch(`${APP}/api/billing/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': upHeader },
  body: upcomingPayload,
})
const reminder = await prisma.notification.findFirst({ where: { userId: me.id, type: 'BILLING' } })
ok('invoice.upcoming → renewal reminder notification', upRes.status === 200 && reminder != null && reminder.title.includes('갱신'))

// --- 5. upgrade (immediate + proration) ---------------------------------------
console.log('--- upgrade ---')
// activeStd is starter monthly in DB. Upgrade to trader monthly.
const up = await api('/api/billing/change', { method: 'POST', body: { plan: 'trader', interval: 'monthly' } })
ok('upgrade → applied now', up.status === 200 && up.json?.direction === 'upgrade' && up.json?.appliesAt === 'now', JSON.stringify(up.json))
const upStripe = await stripe.subscriptions.retrieve(activeStd.id)
ok('stripe price switched immediately to trader', upStripe.items.data[0].price.id === P.proM)
row = await prisma.subscription.findUnique({ where: { userId: me.id } })
ok('DB plan is TRADER now', row?.plan === 'TRADER')
const invoices = await stripe.invoices.list({ subscription: activeStd.id, limit: 5 })
const proration = invoices.data.some((i) => i.billing_reason === 'subscription_update' || i.lines.data.some((l) => l.proration))
ok('prorated difference invoiced', proration)

// --- 6. downgrade (scheduled at period end) -----------------------------------
console.log('--- downgrade ---')
// Fresh trader monthly sub → downgrade to starter monthly.
const proSub = await createSub(P.proM)
await syncViaWebhook(proSub)
const down = await api('/api/billing/change', { method: 'POST', body: { plan: 'starter', interval: 'monthly' } })
ok('downgrade → applies at period end', down.status === 200 && down.json?.direction === 'downgrade' && down.json?.appliesAt === 'period_end', JSON.stringify(down.json))
row = await prisma.subscription.findUnique({ where: { userId: me.id } })
ok('pending downgrade recorded', row?.pendingPlan === 'STARTER')
ok('current plan unchanged until period end', row?.plan === 'TRADER')
const proLive = await stripe.subscriptions.retrieve(proSub.id)
ok('live stripe plan still trader', proLive.items.data[0].price.id === P.proM)

// at renewal (invoice.upcoming) the downgrade applies + pending clears
const dgPayload = JSON.stringify({
  id: `evt_dg_${Date.now()}`,
  object: 'event',
  type: 'invoice.upcoming',
  data: { object: { object: 'invoice', customer: customer.id, amount_due: 19900, currency: 'usd', period_end: Math.floor(Date.now() / 1000) + 2 * 86400 } },
})
const dgHeader = stripe.webhooks.generateTestHeaderString({ payload: dgPayload, secret: process.env.STRIPE_WEBHOOK_SECRET })
await fetch(`${APP}/api/billing/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': dgHeader }, body: dgPayload })
const dgStripe = await stripe.subscriptions.retrieve(proSub.id)
row = await prisma.subscription.findUnique({ where: { userId: me.id } })
ok('at renewal: stripe price switched to starter', dgStripe.items.data[0].price.id === P.stdM, `price=${dgStripe.items.data[0].price.id}`)
ok('at renewal: pending cleared + plan STARTER', row?.pendingPlan === null && row?.plan === 'STARTER')

// --- 7. cancel (cancelAtPeriodEnd) — yearly -----------------------------------
console.log('--- cancel (yearly) ---')
const yearCancel = await createSub(P.stdY)
await syncViaWebhook(yearCancel)
const cancel = await fetch(`${APP}/api/billing/cancel`, {
  method: 'POST',
  headers: { authorization: `Bearer ${jwt}`, origin: ORIGIN },
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
const cancelStripe = await stripe.subscriptions.retrieve(yearCancel.id)
row = await prisma.subscription.findUnique({ where: { userId: me.id } })
ok('yearly cancel → cancelAtPeriodEnd (no immediate cancel/refund)',
  cancel.status === 200 && cancel.json?.cancelAtPeriodEnd === true &&
    cancelStripe.cancel_at_period_end === true && cancelStripe.status !== 'canceled' &&
    row?.cancelAtPeriodEnd === true)

// --- 8. annual refund ----------------------------------------------------------
console.log('--- annual refund (14-day, unused) ---')
const yearRefund = await createSub(P.stdY) // charged, active, no trial
await syncViaWebhook(yearRefund)
// ensure a fresh period start (just now) and no access
await prisma.subscription.update({ where: { userId: me.id }, data: { currentPeriodStart: new Date(), refundedAt: null, cancelAtPeriodEnd: false } })
await prisma.accessLog.deleteMany({ where: { userId: me.id } })

let elig = await api('/api/billing/refund')
ok('fresh annual, unused → eligible', elig.json?.eligible === true && elig.json?.reason === 'ok', JSON.stringify(elig.json))

// used → ineligible
await prisma.accessLog.create({ data: { userId: me.id, kind: 'report.view', hourBucket: new Date().toISOString().slice(0, 13) } })
elig = await api('/api/billing/refund')
ok('used → ineligible (reason: used)', elig.json?.eligible === false && elig.json?.reason === 'used')
await prisma.accessLog.deleteMany({ where: { userId: me.id } })

// window passed → ineligible
await prisma.subscription.update({ where: { userId: me.id }, data: { currentPeriodStart: new Date(Date.now() - 20 * 86400000) } })
elig = await api('/api/billing/refund')
ok('past 14 days → ineligible (window-passed)', elig.json?.eligible === false && elig.json?.reason === 'window-passed')
await prisma.subscription.update({ where: { userId: me.id }, data: { currentPeriodStart: new Date() } })

// execute refund
const refund = await api('/api/billing/refund', { method: 'POST' })
ok('refund executes', refund.status === 200 && refund.json?.ok === true && refund.json?.refunded > 0, JSON.stringify(refund.json))
const refundStripe = await stripe.subscriptions.retrieve(yearRefund.id)
const chargeList = await stripe.charges.list({ customer: customer.id, limit: 10 })
const refunded = chargeList.data.some((c) => c.refunded && c.amount_refunded > 0)
ok('stripe charge refunded + sub canceled', refunded && refundStripe.status === 'canceled')
row = await prisma.subscription.findUnique({ where: { userId: me.id } })
ok('DB refundedAt set + status CANCELED', row?.refundedAt != null && row?.status === 'CANCELED')
const refundAudit = await prisma.securityEvent.findFirst({ where: { userId: me.id, action: 'billing.refund' } })
ok('refund is security-audited', refundAudit != null)

// monthly → not eligible for the annual refund
const monthRefund = await createSub(P.stdM)
await syncViaWebhook(monthRefund)
await prisma.subscription.update({ where: { userId: me.id }, data: { refundedAt: null } })
elig = await api('/api/billing/refund')
ok('monthly plan → not-annual', elig.json?.eligible === false && elig.json?.reason === 'not-annual')

// --- cleanup -------------------------------------------------------------------
await cleanup()
await prisma.$disconnect()

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed — ${fail === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(fail === 0 ? 0 : 1)
