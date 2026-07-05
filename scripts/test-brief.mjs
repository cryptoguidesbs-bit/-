// Stage 9 — AI Market Brief test: auto-generation, tiering, expression
// guidelines, budget management, audit logging, disclaimer.
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

const post = async (path, body, extraHeaders = {}) => {
  const res = await fetch(`${APP}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': SECRET, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

// --- guideline reference battery (mirrors src/lib/brief/guidelines.ts) -------
const BANNED = [
  /(반드시|확실히|무조건|틀림없이).{0,12}(상승|하락|급등|급락|오른|내린|도달)/,
  /(급등|급락|상승|하락|돌파|도달)할 것입니다/,
  /매수하세요|매도하세요|사세요|파세요|추천합니다/,
  /수익.{0,6}보장|보장된.{0,6}수익/,
  /\bwill (surge|soar|crash|plunge|rise|fall|moon|double|reach|hit)\b/i,
  /\b(buy|sell) now\b|\byou should (buy|sell)\b/i,
  /guaranteed (profit|return|gain)|risk[- ]free/i,
]
const PROB_KO = /가능성|수 있|보입니다|보이며|관측|전망|예상|우려|기대|시사|추정|평가|해석|주목|분석됩니다|나타냅니다/
const PROB_EN = /\b(may|could|might|likely|unlikely|possib\w*|appear\w*|suggest\w*|potential\w*|expect\w*|seem\w*|indicat\w*)\b/i
const SECTION_KEYS = ['btc', 'eth', 'altcoin', 'macro', 'today']

function verifyGuidelines(sections, label) {
  let violations = []
  for (const key of SECTION_KEYS) {
    const s = sections[key]
    if (!s?.ko || !s?.en) {
      violations.push(`${key}: missing`)
      continue
    }
    for (const p of BANNED) {
      if (p.test(s.ko)) violations.push(`${key}.ko banned: ${s.ko.match(p)[0]}`)
      if (p.test(s.en)) violations.push(`${key}.en banned: ${s.en.match(p)[0]}`)
    }
    if (!PROB_KO.test(s.ko)) violations.push(`${key}.ko no probabilistic language`)
    if (!PROB_EN.test(s.en)) violations.push(`${key}.en no probabilistic language`)
  }
  ok(`${label}: guideline compliance (no definitive/directive/guarantee, probabilistic present)`,
    violations.length === 0, violations.slice(0, 3).join('; '))
}

// --- clerk session helper -----------------------------------------------------
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
const tokenRes = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', { expires_in_seconds: 600 })
const jwt = tokenRes?.jwt
const dbUser = await prisma.user.findFirst({ where: { email: EMAIL } })
await prisma.user.update({ where: { id: dbUser.id }, data: { role: 'USER' } })

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

const TODAY = new Date().toISOString().slice(0, 10)
const FAKE_VIOLATION_DATE = '2020-01-01'
const FAKE_BUDGET_DATE = '2020-01-02'

// Clean slate for repeatable runs.
await prisma.marketBrief.deleteMany({
  where: { briefDate: { in: [TODAY, FAKE_VIOLATION_DATE, FAKE_BUDGET_DATE] } },
})

// --- 1. auth ------------------------------------------------------------------
console.log('--- trigger auth ---')
const noAuth = await fetch(`${APP}/api/brief/generate`, { method: 'POST' })
ok('generate without secret → 403', noAuth.status === 403, `status=${noAuth.status}`)

// --- 2. auto-generation ---------------------------------------------------------
console.log('--- auto-generation ---')
const gen = await post('/api/brief/generate', { date: TODAY })
ok(
  'generate publishes both tiers',
  gen.status === 200 && gen.json?.tiers?.every((t) => t.status === 'published'),
  JSON.stringify(gen.json),
)

const briefs = await prisma.marketBrief.findMany({ where: { briefDate: TODAY } })
ok('two tier rows exist (STANDARD + DETAILED)', briefs.length === 2 &&
  new Set(briefs.map((b) => b.tier)).size === 2)

for (const brief of briefs) {
  const sections = brief.sections
  ok(
    `${brief.tier}: published with 5 sections × ko/en + model label`,
    brief.status === 'PUBLISHED' &&
      SECTION_KEYS.every((k) => sections[k]?.ko && sections[k]?.en) &&
      !!brief.aiModel,
    `model=${brief.aiModel}`,
  )
  verifyGuidelines(sections, brief.tier)
}

const detailedBrief = briefs.find((b) => b.tier === 'DETAILED')
const standardBrief = briefs.find((b) => b.tier === 'STANDARD')
ok(
  'detailed tier is longer than standard (distinct versions)',
  JSON.stringify(detailedBrief?.sections).length > JSON.stringify(standardBrief?.sections).length,
  `detailed=${JSON.stringify(detailedBrief?.sections).length} standard=${JSON.stringify(standardBrief?.sections).length}`,
)

// idempotency
const regen = await post('/api/brief/generate', { date: TODAY })
ok(
  're-generate is idempotent (skipped)',
  regen.json?.tiers?.every((t) => t.status === 'skipped'),
  JSON.stringify(regen.json?.tiers),
)

// --- 3. audit log ----------------------------------------------------------------
console.log('--- audit log ---')
const audits = await prisma.contentAuditLog.findMany({
  where: { contentType: 'BRIEF', contentId: { in: briefs.map((b) => b.id) } },
})
ok(
  'ContentAuditLog rows written for both published briefs (action PUBLISH)',
  audits.length === 2 && audits.every((a) => a.action === 'PUBLISH'),
  `count=${audits.length}`,
)

// --- 4. guideline violation → HELD ------------------------------------------------
console.log('--- guideline enforcement ---')
const bad = await post('/api/brief/generate', {
  date: FAKE_VIOLATION_DATE,
  mockScenario: 'violation',
})
const heldRows = await prisma.marketBrief.findMany({ where: { briefDate: FAKE_VIOLATION_DATE } })
ok(
  'violating output → HELD after retries, never published',
  bad.json?.tiers?.every((t) => t.status === 'held') &&
    heldRows.length === 2 &&
    heldRows.every((b) => b.status === 'HELD' && b.attempts >= 2),
  heldRows.map((b) => `${b.tier}:${b.status} "${(b.holdReason ?? '').slice(0, 50)}"`).join(' | '),
)
ok(
  'hold reason names the violation type',
  heldRows.every((b) => /definitive|directive|guarantee/.test(b.holdReason ?? '')),
  heldRows[0]?.holdReason,
)
const heldAudit = await prisma.contentAuditLog.count({
  where: { contentType: 'BRIEF', contentId: { in: heldRows.map((b) => b.id) } },
})
ok('held briefs get no PUBLISH audit entry', heldAudit === 0)

// --- 5. LLM budget management ------------------------------------------------------
console.log('--- cost / rate-limit management ---')
const usage = await prisma.aiUsage.findUnique({ where: { day: TODAY } })
ok('AI usage tracked (calls recorded today)', (usage?.calls ?? 0) > 0, `calls=${usage?.calls}`)

// Exhaust the budget artificially → generation must defer with 429.
await prisma.aiUsage.update({ where: { day: TODAY }, data: { calls: 999999 } })
const overBudget = await post('/api/brief/generate', { date: FAKE_BUDGET_DATE })
ok(
  'over budget → 429 + deferred (no publish)',
  overBudget.status === 429 && overBudget.json?.tiers?.every((t) => t.status === 'deferred'),
  JSON.stringify(overBudget.json?.tiers),
)
const budgetRows = await prisma.marketBrief.count({ where: { briefDate: FAKE_BUDGET_DATE } })
ok('no brief rows created while over budget', budgetRows === 0)
// Restore a sane counter.
await prisma.aiUsage.update({ where: { day: TODAY }, data: { calls: usage?.calls ?? 10 } })

// --- 6. tiered access ---------------------------------------------------------------
console.log('--- tiered access ---')
const anon = await fetch(`${APP}/api/brief`).then((r) => r.json())
ok(
  'FREE/anonymous → locked teaser (today section only)',
  anon.locked === true && anon.sections?.today && !anon.sections?.btc,
  `keys=${Object.keys(anon.sections ?? {}).join(',')}`,
)

await setPlan('STANDARD')
const std = await fetch(`${APP}/api/brief`, { headers: { authorization: `Bearer ${jwt}` } }).then((r) => r.json())
ok(
  'STANDARD → full basic brief (5 sections), no detailed access',
  std.locked === false && std.tier === 'standard' && std.detailedAvailable === false &&
    SECTION_KEYS.every((k) => std.sections?.[k]),
  `tier=${std.tier}`,
)

await setPlan('PROFESSIONAL')
const pro = await fetch(`${APP}/api/brief`, { headers: { authorization: `Bearer ${jwt}` } }).then((r) => r.json())
ok('PROFESSIONAL → detailed version by default', pro.tier === 'detailed' && pro.locked === false)
const proStd = await fetch(`${APP}/api/brief?tier=standard`, {
  headers: { authorization: `Bearer ${jwt}` },
}).then((r) => r.json())
ok('PROFESSIONAL can switch to standard view', proStd.tier === 'standard')

// --- 7. page + disclaimer ------------------------------------------------------------
console.log('--- page ---')
const page = await fetch(`${APP}/ko/brief`)
const html = await page.text()
ok(
  '/ko/brief renders with always-visible disclaimer',
  page.status === 200 &&
    html.includes('data-testid="brief-disclaimer"') &&
    html.includes('data-testid="brief-page"'),
  `status=${page.status}`,
)

// --- cleanup --------------------------------------------------------------------------
await prisma.marketBrief.deleteMany({ where: { briefDate: { in: [FAKE_VIOLATION_DATE, FAKE_BUDGET_DATE] } } })
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
