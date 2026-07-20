// Stage 6 — plan × feature access-matrix test.
//
// Walks every plan (FREE→WHALE), sets the test user's subscription row,
// and asserts the full /api/me/entitlements matrix, premium page gates,
// the Whale-only export API, region whitelist behaviour, admin bypass
// and signed-out behaviour.
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
  if (!pass || process.env.VERBOSE) {
    console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
  }
}

// --- expected matrix (mirrors src/config/features.ts) ----------------------
const RANK = { FREE: 0, STARTER: 1, TRADER: 2, PRO: 3, WHALE: 4 }
const MIN_PLAN = {
  'market.basic': 'FREE',
  'news.limited': 'FREE',
  'brief.limited': 'FREE',
  'news.full': 'STARTER',
  'brief.daily': 'STARTER',
  'dashboard.basic': 'STARTER',
  'brief.detailed': 'TRADER',
  'analysis.patterns': 'TRADER',
  'portfolio.tools': 'TRADER',
  'alerts.realtime': 'TRADER',
  'onchain.advanced': 'PRO',
  'reports.premium': 'PRO',
  'api.center': 'WHALE',
  'data.export': 'WHALE',
}
const REGION_RESTRICTED = ['onchain.advanced', 'api.center', 'data.export']
const PLANS = ['FREE', 'STARTER', 'TRADER', 'PRO', 'WHALE']

// --- clerk session ----------------------------------------------------------
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
const clerkUserId = users?.[0]?.id
const session = await clerkApi('/sessions', 'POST', { user_id: clerkUserId })
const tokenRes = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', {
  expires_in_seconds: 600,
})
const jwt = tokenRes?.jwt
if (!jwt) {
  console.error('could not create session token')
  process.exit(1)
}

const dbUser = await prisma.user.findFirst({ where: { email: EMAIL } })
await prisma.user.update({ where: { id: dbUser.id }, data: { role: 'USER' } })

async function setPlan(plan) {
  if (plan === 'FREE') {
    await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
    return
  }
  await prisma.subscription.upsert({
    where: { userId: dbUser.id },
    update: { plan, status: 'ACTIVE', cancelAtPeriodEnd: false },
    create: { userId: dbUser.id, plan, status: 'ACTIVE' },
  })
}

async function fetchEntitlements(headers = {}) {
  const res = await fetch(`${APP}/api/me/entitlements`, {
    headers: { authorization: `Bearer ${jwt}`, ...headers },
  })
  return res.json()
}

async function fetchPage(path, headers = {}) {
  const res = await fetch(`${APP}${path}`, {
    headers: { authorization: `Bearer ${jwt}`, ...headers },
  })
  return { status: res.status, html: await res.text() }
}

// --- 1. plan × feature matrix ----------------------------------------------
console.log('--- matrix: plan × feature (no geo header) ---')
for (const plan of PLANS) {
  await setPlan(plan)
  const ent = await fetchEntitlements()
  ok(`[${plan}] reported plan`, ent.plan === plan, `got=${ent.plan}`)
  for (const [feature, minPlan] of Object.entries(MIN_PLAN)) {
    const expected = RANK[plan] >= RANK[minPlan]
    const actual = ent.features?.[feature]?.allowed
    ok(`[${plan}] ${feature}`, actual === expected, `expected=${expected} got=${actual}`)
  }
}

// --- 2. premium page gates ---------------------------------------------------
console.log('--- premium pages ---')
await setPlan('FREE')
let page = await fetchPage('/ko/portfolio')
ok('portfolio FREE → plan gate', page.html.includes('data-testid="gate-plan"'))
page = await fetchPage('/ko/reports')
ok('reports FREE → plan gate', page.html.includes('data-testid="gate-plan"'))

await setPlan('TRADER')
page = await fetchPage('/ko/portfolio')
ok('portfolio TRADER → open', !page.html.includes('data-testid="gate-'))
page = await fetchPage('/ko/reports')
ok('reports TRADER → still plan gate', page.html.includes('data-testid="gate-plan"'))

await setPlan('PRO')
page = await fetchPage('/ko/reports')
ok('reports PRO → open', !page.html.includes('data-testid="gate-'))

// --- 3. export API (Whale only) -----------------------------------------
console.log('--- export API ---')
await setPlan('PRO')
let res = await fetch(`${APP}/api/export/market`, { headers: { authorization: `Bearer ${jwt}` } })
ok('export PRO → 403', res.status === 403, `status=${res.status}`)

await setPlan('WHALE')
res = await fetch(`${APP}/api/export/market`, { headers: { authorization: `Bearer ${jwt}` } })
const csv = await res.text()
ok(
  'export WHALE → 200 CSV',
  res.status === 200 && csv.startsWith('symbol,price_usd'),
  `status=${res.status}`,
)

res = await fetch(`${APP}/api/export/market`)
ok('export signed-out → 401', res.status === 401, `status=${res.status}`)

// --- 4. region whitelist (feature-level on/off) ------------------------------
console.log('--- region policy (as WHALE) ---')
await setPlan('WHALE')
const entCN = await fetchEntitlements({ 'x-vercel-ip-country': 'CN' })
for (const feature of REGION_RESTRICTED) {
  ok(
    `CN blocks ${feature} (reason=region)`,
    entCN.features?.[feature]?.allowed === false && entCN.features?.[feature]?.reason === 'region',
    JSON.stringify(entCN.features?.[feature]),
  )
}
ok('CN still allows portfolio.tools', entCN.features?.['portfolio.tools']?.allowed === true)

const entKR = await fetchEntitlements({ 'x-vercel-ip-country': 'KR' })
for (const feature of REGION_RESTRICTED) {
  ok(`KR allows ${feature}`, entKR.features?.[feature]?.allowed === true)
}

const entUnknown = await fetchEntitlements()
ok(
  'unknown country → allowUnknown honored',
  REGION_RESTRICTED.every((f) => entUnknown.features?.[f]?.allowed === true),
)

res = await fetch(`${APP}/api/export/market`, {
  headers: { authorization: `Bearer ${jwt}`, 'x-vercel-ip-country': 'CN' },
})
const body = await res.json().catch(() => null)
ok(
  'export API blocked by region (403/region)',
  res.status === 403 && body?.reason === 'region',
  `status=${res.status} reason=${body?.reason}`,
)

// --- 5. signed-out behaviour --------------------------------------------------
console.log('--- signed out ---')
const entAnon = await fetch(`${APP}/api/me/entitlements`).then((r) => r.json())
ok('signed-out plan is FREE', entAnon.plan === 'FREE' && entAnon.signedIn === false)
ok(
  'signed-out gated feature reason=auth',
  entAnon.features?.['portfolio.tools']?.reason === 'auth',
)
const anonPage = await fetch(`${APP}/ko/portfolio`).then((r) => r.text())
ok('portfolio signed-out → auth gate', anonPage.includes('data-testid="gate-auth"'))

// --- 6. admin bypass -----------------------------------------------------------
console.log('--- admin bypass ---')
await setPlan('FREE')
await prisma.user.update({ where: { id: dbUser.id }, data: { role: 'ADMIN' } })
const entAdmin = await fetchEntitlements()
ok(
  'ADMIN on FREE plan gets all features',
  Object.keys(MIN_PLAN).every((f) => entAdmin.features?.[f]?.allowed === true),
)
const entAdminCN = await fetchEntitlements({ 'x-vercel-ip-country': 'CN' })
ok(
  'region rules still apply to ADMIN',
  entAdminCN.features?.['data.export']?.allowed === false &&
    entAdminCN.features?.['data.export']?.reason === 'region',
)

// --- cleanup -------------------------------------------------------------------
await prisma.user.update({ where: { id: dbUser.id }, data: { role: 'USER' } })
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
