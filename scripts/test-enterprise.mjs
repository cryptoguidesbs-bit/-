// Enterprise tier test.
//  1. Pricing page: card (quote-only, no Stripe price), comparison row, note
//     line, and the absence of a trial note / checkout price block.
//  2. Contact Sales API: stores the lead, notifies admins, validates input,
//     and rate limits abuse.
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
const prisma = new PrismaClient()

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

const MARK = `e2e-${Date.now()}`
// The limiter buckets by client IP, so give each run its own IP. Without this
// a re-run inside the same minute would inherit the previous run's window.
const RUN_IP = `203.0.113.${Math.floor(Math.random() * 200) + 1}`

const post = (body, headers = {}) =>
  fetch(`${APP}/api/enterprise/inquiry`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': RUN_IP,
      ...headers,
    },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
const valid = {
  email: `${MARK}@example.com`,
  organization: 'Example Capital',
  teamSize: '12',
  useCase: 'Team research and internal dashboards',
  locale: 'en',
}

// --- 1. pricing page surface ----------------------------------------------------
console.log('--- pricing page (Enterprise tier) ---')
const ko = await fetch(`${APP}/ko`).then((r) => r.text())
const en = await fetch(`${APP}/en`).then((r) => r.text())

ok('enterprise card rendered', ko.includes('data-testid="price-contact-enterprise"'))
ok('enterprise has NO stripe price block', !ko.includes('data-testid="price-monthly-enterprise"'))
ok('ko from-price + billing note', ko.includes('월 $1,999부터') && ko.includes('연간 계약 · 규모에 따라 협의 · 인보이스 청구'))
ok('en from-price + billing note', en.includes('From $1,999/mo') && en.includes('Annual contract, priced by scale. Billed by invoice.'))
ok('ko/en contact CTA', ko.includes('영업팀 문의') && en.includes('Contact Sales'))
ok('comparison row present', ko.includes('data-testid="compare-row-enterprise"'))
ok('comparison note line present', ko.includes('data-testid="enterprise-compare-note"') && en.includes('Working at a larger scale?'))

// All 14 features render, in both locales.
const enTier = JSON.parse(fs.readFileSync('messages/en.json', 'utf8')).home.pricing.tiers.enterprise
const koTier = JSON.parse(fs.readFileSync('messages/ko.json', 'utf8')).home.pricing.tiers.enterprise
const featureKeys = Object.keys(enTier).filter((k) => /^f\d+$/.test(k))
ok('14 features configured', featureKeys.length === 14, `count=${featureKeys.length}`)
ok('all EN features rendered', featureKeys.every((k) => en.includes(enTier[k])))
ok('all KO features rendered', featureKeys.every((k) => ko.includes(koTier[k])))

// Enterprise is invoice-billed, so it must not advertise the 7-day trial.
const entCard = (() => {
  const at = ko.indexOf('data-testid="price-contact-enterprise"')
  return at >= 0 ? ko.slice(at, ko.indexOf('data-testid="pricing-compare"', at)) : ''
})()
ok('no trial note on the enterprise card', !entCard.includes('7일 무료 체험'))
ok('paid tiers still show the 7-day trial', ko.includes('7일 무료 체험'))

// Compliance: no advice / guarantee / signal phrasing in the new copy.
const copy = JSON.stringify({ enTier, koTier, en: JSON.parse(fs.readFileSync('messages/en.json', 'utf8')).home.pricing.enterprise })
ok('no advice/guarantee phrasing in enterprise copy',
  !/(guarantee|guaranteed|profit|returns of|보장|수익률|매수|매도)/i.test(copy))
ok('no em-dash in English enterprise copy', !/—/.test(JSON.stringify({ enTier, b: JSON.parse(fs.readFileSync('messages/en.json', 'utf8')).home.pricing.enterprise })))

// --- 2. contact sales API -------------------------------------------------------
console.log('--- contact sales API ---')
// Seed a temporary ADMIN so the operator-notification path is really executed
// (the resting DB has no admin — role is reset by the admin suite).
const tempAdmin = await prisma.user.create({
  data: {
    clerkId: `ent_admin_${MARK}`,
    email: `admin-${MARK}@example.com`,
    role: 'ADMIN',
    locale: 'ko',
  },
})
const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
ok('temp admin seeded for notification check', admins.length >= 1, `admins=${admins.length}`)
const before = await prisma.notification.count({ where: { title: { startsWith: '[Enterprise 문의]' } } })

let res = await post(valid)
ok('valid inquiry accepted', res.status === 201 && res.json?.ok === true, `status=${res.status}`)

const row = await prisma.enterpriseInquiry.findFirst({ where: { email: valid.email } })
ok('lead stored with all fields',
  row?.organization === valid.organization && row?.teamSize === valid.teamSize &&
    row?.useCase === valid.useCase && row?.locale === 'en',
  JSON.stringify(row && { o: row.organization, t: row.teamSize, l: row.locale }))

const after = await prisma.notification.count({ where: { title: { startsWith: '[Enterprise 문의]' } } })
ok('admins notified (one notification per admin)', after - before === admins.length,
  `admins=${admins.length} new=${after - before}`)

const adminNote = await prisma.notification.findFirst({
  where: { userId: tempAdmin.id, title: { startsWith: '[Enterprise 문의]' } },
  orderBy: { createdAt: 'desc' },
})
ok('notification names the organization and contact',
  adminNote?.title.includes(valid.organization) && adminNote?.body?.includes(valid.email),
  JSON.stringify(adminNote && { t: adminNote.title, b: adminNote.body }))

res = await post({ ...valid, email: 'not-an-email' })
ok('invalid email rejected', res.status === 400, `status=${res.status}`)

res = await post({ email: `x-${MARK}@example.com` })
ok('missing required fields rejected', res.status === 400, `status=${res.status}`)

// Rate limit: a separate IP bucket so the functional calls above stay clean,
// with the dev-only header hook forcing the bucket down to 1/min.
const rlIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`
const rlBody = { ...valid, email: `rl-${MARK}@example.com` }
const rlHeaders = { 'x-test-rate-limit': '1', 'x-forwarded-for': rlIp }
const first = await post(rlBody, rlHeaders)
ok('first request in a fresh bucket is accepted', first.status === 201, `status=${first.status}`)
res = await post(rlBody, rlHeaders)
ok('rate limit enforced (429)', res.status === 429, `status=${res.status}`)

// Enterprise must not be checkout-able through the billing API.
const checkout = await fetch(`${APP}/api/billing/checkout`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: APP },
  body: JSON.stringify({ plan: 'enterprise', interval: 'monthly', locale: 'ko' }),
})
ok('enterprise is not a checkout-able plan', checkout.status === 400 || checkout.status === 401,
  `status=${checkout.status}`)

// --- cleanup --------------------------------------------------------------------
await prisma.enterpriseInquiry.deleteMany({ where: { email: { contains: MARK } } })
await prisma.notification.deleteMany({ where: { userId: tempAdmin.id } })
await prisma.user.delete({ where: { id: tempAdmin.id } }).catch(() => {})
await prisma.$disconnect()

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed — ${fail === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(fail === 0 ? 0 : 1)
