// Stage 13 — AI Pattern test: detection correctness on planted synthetic
// patterns, live pipeline, tier gating, and the completion condition —
// automated scan proving NO directive phrasing in any output.
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
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

// --- directive scanner (completion condition) --------------------------------
const DIRECTIVE_PATTERNS = [
  /진입가|진입 ?시점|매수 ?구간|매도 ?구간|목표가|타겟 ?가|손절가|손절 ?라인|익절/,
  /\bentry (price|point|level|zone)\b|\btarget (price|level)\b|\bstop[- ]?loss\b|\btake[- ]?profit\b/i,
  /매수하세요|매도하세요|사세요|파세요|진입하세요|청산하세요|추천(합니다|드립니다)/,
  /\b(buy|sell|enter|exit) (now|here|at)\b|\byou should (buy|sell|enter|exit)\b|\bwe recommend\b/i,
  /(상승|하락|급등|급락|돌파|반등)할 (것입니다|것이다|전망입니다)|반드시|확실히/,
  /\bwill (rise|fall|surge|crash|break ?out|bounce|reach)\b|\bguaranteed\b/i,
]
const scanDirectives = (text) =>
  DIRECTIVE_PATTERNS.filter((p) => p.test(text)).map((p) => text.match(p)[0])

// --- synthetic candle builders -------------------------------------------------
const mk = (closes) =>
  closes.map((c, i) => ({
    t: 1700000000000 + i * 3600_000,
    o: c * 0.999,
    h: c * 1.004,
    l: c * 0.996,
    c,
  }))

// Double top: rise → peak 110 → dip 100 → peak 110.2 → fall
const doubleTopCloses = [
  ...Array.from({ length: 10 }, (_, i) => 100 + i), // 100→109
  110, 109, 106, 103, 100, 100.5, 102, 105, 108, // dip
  110.2, 109, 107, 105, 103, 102, 101, 100, 99, 98, 97,
]
// Double bottom: mirror
const doubleBottomCloses = doubleTopCloses.map((c) => 210 - c)
// Head & shoulders: shoulder 108 → dip → head 114 → dip → shoulder 108.5
const hsCloses = [
  100, 102, 104, 106, 108, 106, 104, 102, // left shoulder
  104, 107, 110, 114, 110, 107, 104, // head
  105, 107, 108.5, 106, 104, 102, 100, 99, 98,
]
// Triangle: converging sine waves (period 10, amplitude 8 → 1.5)
const triangleCloses = Array.from({ length: 60 }, (_, i) => {
  const amp = 8 * (1 - i / 70) + 0.5
  return 100 + amp * Math.sin((2 * Math.PI * i) / 10)
})
// Range-bound series (period 8, constant amplitude) → clustered S/R pivots
const rangeCloses = Array.from({ length: 48 }, (_, i) => 100 + 5 * Math.sin((2 * Math.PI * i) / 8))
// Flag: strong pole 100→112 then tight drift ~111-112
const flagCloses = [
  ...Array.from({ length: 12 }, () => 100), // base
  ...Array.from({ length: 12 }, (_, i) => 100 + i), // pole → 111
  111.5, 111.2, 111.6, 111.1, 111.4, 111.0, 111.3, 111.2, // flag
]
// Cup: rim 110 → rounded bottom 98 → rim 110.5
const cupCloses = Array.from({ length: 60 }, (_, i) => {
  const x = (i - 30) / 30
  return 98 + 12 * x * x + (i % 3 === 0 ? 0.3 : 0)
})

// --- 1. detection correctness on planted patterns -------------------------------
console.log('--- detection correctness (synthetic candles) ---')
const detect = async (closes) => {
  const res = await fetch(`${APP}/api/patterns/detect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ candles: mk(closes) }),
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const cases = [
  ['doubleTop', doubleTopCloses],
  ['doubleBottom', doubleBottomCloses],
  ['headShoulders', hsCloses],
  ['triangle', triangleCloses],
  ['flag', flagCloses],
  ['cup', cupCloses],
]
const allOutputs = []
for (const [expected, closes] of cases) {
  const res = await detect(closes)
  const found = res.json?.patterns?.find((p) => p.type === expected)
  ok(`planted ${expected} detected with confidence 40–100`,
    !!found && found.confidence >= 40 && found.confidence <= 100,
    found
      ? `confidence=${found.confidence}`
      : `types=${res.json?.patterns?.map((p) => p.type).join(',') || 'none'}`)
  if (res.json) allOutputs.push(JSON.stringify(res.json))
}

// Support/resistance from a range-bound series (repeated clustered pivots)
const sr = await detect(rangeCloses)
ok('support/resistance levels detected from pivots',
  Array.isArray(sr.json?.levels) && sr.json.levels.length >= 1 &&
    sr.json.levels.every((l) => ['support', 'resistance'].includes(l.kind) && l.touches >= 2),
  `levels=${sr.json?.levels?.length} touches=${sr.json?.levels?.[0]?.touches}`)
if (sr.json) allOutputs.push(JSON.stringify(sr.json))

// --- 2. tier gating -----------------------------------------------------------------
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

const anon = await fetch(`${APP}/api/patterns?symbol=BTC&interval=4h`)
ok('anonymous → 401', anon.status === 401)
for (const [plan, expected] of [
  ['FREE', 403],
  ['STANDARD', 403],
  ['PROFESSIONAL', 200],
  ['INSTITUTIONAL', 200],
]) {
  await setPlan(plan)
  const res = await get('/api/patterns?symbol=BTC&interval=4h')
  ok(`${plan} → ${expected}`, res.status === expected, `status=${res.status}`)
}

// --- 3. live pipeline ------------------------------------------------------------------
console.log('--- live pipeline ---')
await setPlan('PROFESSIONAL')
const live = await get('/api/patterns?symbol=BTC&interval=4h')
ok('live BTC 4h scan returns candles + structures',
  live.json?.available === true && live.json?.closes?.length >= 100 &&
    Array.isArray(live.json?.patterns) && Array.isArray(live.json?.levels),
  `closes=${live.json?.closes?.length} patterns=${live.json?.patterns?.length} levels=${live.json?.levels?.length}`)
ok('live scan finds ≥1 support/resistance level', (live.json?.levels?.length ?? 0) >= 1)
if (live.json) allOutputs.push(JSON.stringify(live.json))

const invalid = await get('/api/patterns?symbol=DOGE&interval=5m')
ok('invalid symbol/interval → 400', invalid.status === 400)

// --- 4. COMPLETION CONDITION: no directive phrasing in any output ----------------------
console.log('--- directive-free output scan ---')
let totalViolations = []
for (const output of allOutputs) {
  totalViolations = totalViolations.concat(scanDirectives(output))
}
ok(`all API outputs (${allOutputs.length} payloads, synthetic + live) free of directive phrasing`,
  totalViolations.length === 0, totalViolations.slice(0, 3).join('; '))

// The page itself (SSR) + disclaimer visible
const page = await fetch(`${APP}/ko/patterns`, { headers: { authorization: `Bearer ${jwt}` } })
const html = await page.text()
ok('/ko/patterns renders with always-visible disclaimer',
  page.status === 200 && html.includes('data-testid="patterns-disclaimer"'),
  `status=${page.status}`)
// Scan visible page text, excluding the disclaimer sentence (which NAMES the
// banned concepts in order to disclaim them).
const bodyText = html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/진입가·목표가·손절가 등 매매 지시는 제공하지 않습니다\./g, '')
const pageViolations = scanDirectives(bodyText)
ok('rendered page free of directive phrasing (outside the disclaimer)',
  pageViolations.length === 0, pageViolations.slice(0, 3).join('; '))

// Gate for lower tier
await setPlan('STANDARD')
const gated = await fetch(`${APP}/ko/patterns`, { headers: { authorization: `Bearer ${jwt}` } })
ok('/ko/patterns as STANDARD → upgrade gate', (await gated.text()).includes('data-testid="gate-plan"'))

// --- cleanup -----------------------------------------------------------------------------
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
