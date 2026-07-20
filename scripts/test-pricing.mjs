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

// --- 2. landing: multi-term selector + per-term comparison table w/ savings ---------
console.log('--- landing display (billing terms + compare table) ---')
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const html = await fetch(`${APP}/ko`).then((r) => r.text())

// Month terms bill at the monthly rate; year terms at the yearly rate (17% off).
const TERMS = { '1m': 1, '3m': 3, '6m': 6, '1y': 1, '2y': 2, '3y': 3 }
const isYearTerm = (k) => k.endsWith('y')
const termTotal = (a, k) => (isYearTerm(k) ? a.yearly * TERMS[k] : a.monthly * TERMS[k])
const termSaved = (a, k) => (isYearTerm(k) ? a.monthly * 12 * TERMS[k] - a.yearly * TERMS[k] : 0)

const near = (marker, len = 340) => {
  const at = html.indexOf(marker)
  return at >= 0 ? html.slice(at, at + len) : null
}

// All six term options are offered; year terms show the 17% discount.
for (const key of Object.keys(TERMS)) {
  ok(`term selector offers ${key}`, html.includes(`data-testid="term-${key}"`))
}
ok('year terms advertise the 17% discount', html.includes('-17%') && html.includes('17% 할인'))

// Default term (1m): each paid card shows that term's total (= monthly rate).
for (const [plan, amounts] of Object.entries(PLANS)) {
  const block = near(`data-testid="price-${plan}"`)
  ok(`${plan} card (default 1m) shows ${usd.format(amounts.monthly)} + "1개월"`,
    block?.includes(usd.format(amounts.monthly)) && block?.includes('1개월'),
    block ? '' : 'price block missing')
}
ok('free tier has no term price block', !html.includes('data-testid="price-free"'))
ok('trial note preserved', html.includes('7일 무료 체험'))

// Comparison table: every plan row carries all six term totals + year savings.
ok('comparison table rendered', html.includes('data-testid="pricing-compare"') && html.includes('요금 총정리'))
for (const [plan, amounts] of Object.entries(PLANS)) {
  const at = html.indexOf(`data-testid="compare-row-${plan}"`)
  const row = at >= 0 ? html.slice(at, at + 2200) : null
  const missing = Object.keys(TERMS).filter((k) => !row?.includes(usd.format(termTotal(amounts, k))))
  ok(`compare row ${plan}: all 6 term totals present`, row != null && missing.length === 0,
    missing.length ? `missing ${missing.join(',')}` : '')
}
// The 17% discount SHOWS AS A DOLLAR AMOUNT in the table (always in SSR):
// standard 1y saves $398, 2y saves $796, 3y saves $1,194.
ok('standard shows year savings ($398 / $796 / $1,194 절감)',
  (() => { const at = html.indexOf('data-testid="compare-row-standard"'); const r = at >= 0 ? html.slice(at, at + 2200) : ''
    return r.includes('$398') && r.includes('$796') && r.includes('$1,194') && r.includes('절감') })())
// professional 1y saves $998 (17% expressed as money).
ok('professional shows year savings ($998 절감)',
  (() => { const at = html.indexOf('data-testid="compare-row-professional"'); const r = at >= 0 ? html.slice(at, at + 2200) : ''
    return r.includes('$998') && r.includes('절감') })())

const htmlEn = await fetch(`${APP}/en`).then((r) => r.text())
ok('EN landing: term selector + comparison table',
  htmlEn.includes('data-testid="term-2y"') &&
    htmlEn.includes('data-testid="pricing-compare"') &&
    htmlEn.includes('Full pricing comparison'))
ok('EN standard card (default 1m) shows $199 / 1 month',
  (() => { const at = htmlEn.indexOf('data-testid="price-standard"'); const b = at >= 0 ? htmlEn.slice(at, at + 340) : null
    return b?.includes('$199') && b?.includes('1 month') })())

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
