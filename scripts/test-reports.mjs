// Stage 14 — Premium Research test: generate → review(검수) → publish
// pipeline, guideline enforcement, audit logging, tier gating.
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
const SECRET = process.env.CRON_SECRET
const EMAIL = 'flowtest+clerk_test@example.com'
const prisma = new PrismaClient()

let passCount = 0
let failCount = 0
const ok = (name, pass, detail = '') => {
  if (pass) passCount++
  else failCount++
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

const post = async (path, body) => {
  const res = await fetch(`${APP}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': SECRET },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

// Guideline battery (mirrors narrative checker bans)
const BANNED = [
  /매수하세요|매도하세요|사세요|파세요|추천(합니다|드립니다)/,
  /진입가|목표가|손절가/,
  /(급등|급락|상승|하락|돌파|도달)할 것입니다/,
  /수익.{0,6}보장|보장된.{0,6}수익/,
  /\bwill (surge|soar|crash|plunge|rise|fall|moon|double|reach|hit)\b/i,
  /\b(buy|sell) now\b/i,
  /\bentry price\b|\btarget price\b|\bstop[- ]?loss\b/i,
  /guaranteed (profit|return|gain)|risk[- ]free/i,
]
const PROB_KO = /가능성|수 있|보입니다|보이며|관측|전망|예상|우려|기대|시사|추정|평가|해석|주목|분석됩니다|나타냅니다/
const PROB_EN = /\b(may|could|might|likely|possib\w*|appear\w*|suggest\w*|potential\w*|expect\w*|seem\w*|indicat\w*)\b/i

// Clean slate for this period
const TEST_DATE = '2026-07-06'
await prisma.report.deleteMany({ where: { periodKey: { in: ['2026-W28', '2026-07', '2026-Q3', '2020-W01'] } } })

// --- 1. auth ---------------------------------------------------------------------
console.log('--- trigger auth ---')
const noAuth = await fetch(`${APP}/api/reports/generate`, { method: 'POST' })
ok('generate without secret → 403', noAuth.status === 403)

// --- 2. generate → review → publish (weekly) ---------------------------------------
console.log('--- weekly pipeline ---')
const gen = await post('/api/reports/generate', { cadence: 'WEEKLY', date: TEST_DATE })
ok('weekly run publishes all 3 categories',
  gen.status === 200 && gen.json?.items?.length === 3 &&
    gen.json.items.every((i) => i.status === 'published'),
  JSON.stringify(gen.json?.items))
const periodKey = gen.json?.periodKey
ok('periodKey is ISO week format', /^\d{4}-W\d{2}$/.test(periodKey ?? ''), periodKey)

const published = await prisma.report.findMany({ where: { periodKey, status: 'PUBLISHED' } })
ok('6 published rows (3 categories × ko/en)',
  published.length === 6 &&
    new Set(published.map((r) => r.category)).size === 3 &&
    new Set(published.map((r) => r.locale)).size === 2)
ok('rows carry full metadata (cadence/category/aiModel/publishedAt/summary/content)',
  published.every((r) =>
    r.cadence === 'WEEKLY' && r.category && r.aiModel && r.publishedAt &&
    (r.summary ?? '').length > 30 && r.content.length > 300))

// Guideline compliance over ALL published text
let violations = []
for (const report of published) {
  const text = `${report.title}\n${report.summary}\n${report.content}`
  for (const p of BANNED) {
    const m = text.match(p)
    if (m) violations.push(`${report.slug}/${report.locale}: ${m[0]}`)
  }
  const prob = report.locale === 'ko' ? PROB_KO : PROB_EN
  if (!prob.test(report.content)) violations.push(`${report.slug}/${report.locale}: no probabilistic language`)
}
ok('published content passes guideline battery (no directives, probabilistic present)',
  violations.length === 0, violations.slice(0, 3).join('; '))

// --- 3. audit logs ------------------------------------------------------------------
console.log('--- audit trail ---')
const audits = await prisma.contentAuditLog.findMany({
  where: { contentType: 'REPORT', reportId: { in: published.map((r) => r.id) } },
})
const reviews = audits.filter((a) => a.action === 'REVIEW')
const publishes = audits.filter((a) => a.action === 'PUBLISH')
ok('REVIEW audit per row (6) + PUBLISH audit per row (6)',
  reviews.length === 6 && publishes.length === 6,
  `review=${reviews.length} publish=${publishes.length}`)

// --- 4. idempotency ------------------------------------------------------------------
const regen = await post('/api/reports/generate', { cadence: 'WEEKLY', date: TEST_DATE })
ok('re-run same period → skipped', regen.json?.items?.every((i) => i.status === 'skipped'))

// --- 5. review holds violations -------------------------------------------------------
console.log('--- review (검수) enforcement ---')
const bad = await post('/api/reports/generate', {
  cadence: 'WEEKLY',
  date: '2020-01-01',
  mockScenario: 'violation',
})
ok('violating generation → all held (never published)',
  bad.json?.items?.every((i) => i.status === 'held' && /directive|prediction|guarantee|levels/.test(i.reason ?? '')),
  bad.json?.items?.[0]?.reason)
const heldRows = await prisma.report.findMany({ where: { periodKey: '2020-W01' } })
ok('held rows stay IN_REVIEW with reviewNote, no publishedAt',
  heldRows.length === 6 &&
    heldRows.every((r) => r.status === 'IN_REVIEW' && r.reviewNote && !r.publishedAt))
const heldPublishAudits = await prisma.contentAuditLog.count({
  where: { contentType: 'REPORT', action: 'PUBLISH', reportId: { in: heldRows.map((r) => r.id) } },
})
const heldReviewAudits = await prisma.contentAuditLog.count({
  where: { contentType: 'REPORT', action: 'REVIEW', reportId: { in: heldRows.map((r) => r.id) } },
})
ok('held rows: REVIEW audit exists, no PUBLISH audit',
  heldPublishAudits === 0 && heldReviewAudits === 6,
  `review=${heldReviewAudits} publish=${heldPublishAudits}`)

// --- 6. monthly/quarterly period keys --------------------------------------------------
const monthly = await post('/api/reports/generate', { cadence: 'MONTHLY', date: TEST_DATE })
ok('monthly periodKey format', monthly.json?.periodKey === '2026-07', monthly.json?.periodKey)
const quarterly = await post('/api/reports/generate', { cadence: 'QUARTERLY', date: TEST_DATE })
ok('quarterly periodKey format', quarterly.json?.periodKey === '2026-Q3', quarterly.json?.periodKey)

// --- 7. tier gating ----------------------------------------------------------------------
console.log('--- tier gating ---')
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
const get = async (path) => {
  const res = await fetch(`${APP}${path}`, { headers: { authorization: `Bearer ${jwt}` } })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const anon = await fetch(`${APP}/api/reports`)
ok('anonymous list → 401', anon.status === 401)
for (const [plan, expected] of [
  ['PROFESSIONAL', 403],
  ['INSTITUTIONAL', 200],
  ['LEGENDARY', 200],
]) {
  await setPlan(plan)
  const res = await get('/api/reports?locale=ko')
  ok(`${plan} list → ${expected}`, res.status === expected, `status=${res.status}`)
}

await setPlan('INSTITUTIONAL')
const list = await get('/api/reports?locale=ko&cadence=WEEKLY')
ok('list returns published weekly reports (held rows excluded)',
  list.json?.items?.length >= 3 &&
    list.json.items.every((i) => i.cadence === 'WEEKLY') &&
    !list.json.items.some((i) => i.periodKey === '2020-W01'),
  `count=${list.json?.items?.length}`)

const slug = list.json.items[0].slug
const detail = await get(`/api/reports/${slug}?locale=ko`)
ok('detail returns full content', detail.status === 200 && detail.json?.content?.includes('##'))
const missing = await get('/api/reports/etf-weekly-2020-W01?locale=ko')
ok('held report detail → 404 (never served)', missing.status === 404)

// Pages
const pageOk = await fetch(`${APP}/ko/reports`, { headers: { authorization: `Bearer ${jwt}` } })
const htmlOk = await pageOk.text()
ok('/ko/reports renders with disclaimer', pageOk.status === 200 &&
  htmlOk.includes('data-testid="reports-disclaimer"'))
const detailPage = await fetch(`${APP}/ko/reports/${slug}`, { headers: { authorization: `Bearer ${jwt}` } })
ok('report detail page renders', detailPage.status === 200 &&
  (await detailPage.text()).includes('data-testid="report-detail"'))

await setPlan('PROFESSIONAL')
const gated = await fetch(`${APP}/ko/reports`, { headers: { authorization: `Bearer ${jwt}` } })
ok('/ko/reports as PROFESSIONAL → upgrade gate', (await gated.text()).includes('data-testid="gate-plan"'))

// --- cleanup --------------------------------------------------------------------------------
await prisma.report.deleteMany({ where: { periodKey: '2020-W01' } })
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
