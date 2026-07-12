// Pricing display & yearly-discount test.
//  1. Stripe seeded prices match config for all 4 plans × monthly/yearly,
//     and yearly === monthly × 10 (2 months free ≈ 17% off) — the discount
//     the operator configured actually exists in Stripe.
//  2. Landing cards express BOTH terms: monthly price + yearly hint (with
//     the discounted yearly amount) in the default view; toggle + badge
//     markup present; free tier carries no hint.
//  3. Checkout E2E: the created Stripe session bills the exact price for
//     the chosen interval (monthly and yearly line items verified).
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

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

// A-3 pricing (USD). Yearly = monthly × 10.
const PLANS = {
  standard: { monthly: 199, yearly: 1990 },
  professional: { monthly: 499, yearly: 4990 },
  institutional: { monthly: 1499, yearly: 14990 },
  legendary: { monthly: 4999, yearly: 49990 },
}
const PRICE_ENV = (plan, interval) =>
  `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`

// --- 1. Stripe seeded prices = configured discount --------------------------------
console.log('--- stripe prices (discount configuration) ---')
for (const [plan, amounts] of Object.entries(PLANS)) {
  for (const interval of ['monthly', 'yearly']) {
    const id = process.env[PRICE_ENV(plan, interval)]
    const price = await stripe.prices.retrieve(id)
    const expected = amounts[interval] * 100
    const wantInterval = interval === 'monthly' ? 'month' : 'year'
    ok(`${plan}/${interval} → $${amounts[interval]} (${wantInterval})`,
      price.unit_amount === expected &&
        price.currency === 'usd' &&
        price.recurring?.interval === wantInterval,
      `unit=${price.unit_amount} cur=${price.currency} int=${price.recurring?.interval}`)
  }
  const savesPct = Math.round(((amounts.monthly * 12 - amounts.yearly) / (amounts.monthly * 12)) * 100)
  ok(`${plan}: yearly = monthly × 10 (2 months free, ${savesPct}% off)`,
    amounts.yearly === amounts.monthly * 10 && savesPct === 17)
}

// --- 2. landing expresses both terms -----------------------------------------------
console.log('--- landing display (both terms) ---')
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const html = await fetch(`${APP}/ko`).then((r) => r.text())

// Default (monthly) view: monthly price + per-month marker + yearly hint
// containing the discounted yearly amount, per paid plan.
for (const [plan, amounts] of Object.entries(PLANS)) {
  const marker = `data-testid="yearly-hint-${plan}"`
  const at = html.indexOf(marker)
  const window = at >= 0 ? html.slice(at, at + 300) : ''
  ok(`${plan}: monthly price + yearly hint (${usd.format(amounts.yearly)}/년)`,
    html.includes(usd.format(amounts.monthly)) &&
      html.includes(`data-testid="period-${plan}"`) &&
      at >= 0 &&
      window.includes(usd.format(amounts.yearly)),
    at >= 0 ? '' : 'hint testid missing')
}
ok('free tier has no yearly hint', !html.includes('data-testid="yearly-hint-free"'))
ok('monthly/yearly toggle + "2개월 무료" present',
  html.includes('월간') && html.includes('연간') && html.includes('2개월 무료'))
ok('trial note preserved', html.includes('7일 무료 체험'))

const htmlEn = await fetch(`${APP}/en`).then((r) => r.text())
const enAt = htmlEn.indexOf('data-testid="yearly-hint-standard"')
ok('EN landing: yearly hint with $1,990',
  enAt >= 0 && htmlEn.slice(enAt, enAt + 300).includes('$1,990'))

// --- 3. checkout bills the correct interval price (E2E) -----------------------------
console.log('--- checkout amounts (Stripe sessions) ---')
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
const tok = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', { expires_in_seconds: 600 })
const jwt = tok?.jwt
const me = await prisma.user.findFirst({ where: { email: EMAIL } })
await prisma.subscription.deleteMany({ where: { userId: me.id } }) // checkout needs no active sub

const openedSessions = []
async function checkoutLineItem(plan, interval) {
  const res = await fetch(`${APP}/api/billing/checkout`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json', origin: APP },
    body: JSON.stringify({ plan, interval, locale: 'ko' }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.id) return { error: `status=${res.status}` }
  openedSessions.push(json.id)
  const items = await stripe.checkout.sessions.listLineItems(json.id, { limit: 1 })
  return { priceId: items.data[0]?.price?.id, unit: items.data[0]?.price?.unit_amount }
}

let li = await checkoutLineItem('standard', 'monthly')
ok('checkout standard/monthly bills $199',
  li.priceId === process.env[PRICE_ENV('standard', 'monthly')] && li.unit === 19900,
  JSON.stringify(li))

li = await checkoutLineItem('standard', 'yearly')
ok('checkout standard/yearly bills $1,990 (discounted, not 199×12)',
  li.priceId === process.env[PRICE_ENV('standard', 'yearly')] && li.unit === 199000,
  JSON.stringify(li))

li = await checkoutLineItem('professional', 'yearly')
ok('checkout professional/yearly bills $4,990',
  li.priceId === process.env[PRICE_ENV('professional', 'yearly')] && li.unit === 499000,
  JSON.stringify(li))

// --- cleanup ---------------------------------------------------------------------------
for (const id of openedSessions) await stripe.checkout.sessions.expire(id).catch(() => {})
await prisma.$disconnect()

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed — ${fail === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(fail === 0 ? 0 : 1)
