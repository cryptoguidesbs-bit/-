// Stage 15 — Education test: curriculum structure (4 tracks × 3 levels)
// and tier-based access (free / member / standard funnel).
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
const count = (haystack, needle) => haystack.split(needle).length - 1

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
const page = async (path, authed = false) => {
  const res = await fetch(`${APP}${path}`, {
    headers: authed ? { authorization: `Bearer ${jwt}` } : {},
  })
  return { status: res.status, html: await res.text() }
}

// Representative lessons per access tier
const FREE_LESSON = '/ko/education/trading-exchange-basics'
const MEMBER_LESSON = '/ko/education/technical-trend-sr'
const STANDARD_LESSON = '/ko/education/risk-drawdown-metrics'

// --- 1. curriculum structure ---------------------------------------------------
console.log('--- curriculum structure ---')
const hub = await page('/ko/education')
ok('education hub renders (signed-out)', hub.status === 200 &&
  hub.html.includes('data-testid="education-page"'))
for (const track of ['trading', 'technical', 'risk', 'psychology']) {
  ok(`track section: ${track}`, hub.html.includes(`data-testid="track-${track}"`))
}
const totalCards =
  count(hub.html, 'data-testid="lesson-open"') + count(hub.html, 'data-testid="lesson-locked"')
ok('12 lesson cards (4 tracks × 3 levels)', totalCards === 12, `cards=${totalCards}`)
ok('levels present (입문/중급/고급)',
  hub.html.includes('입문') && hub.html.includes('중급') && hub.html.includes('고급'))

// Funnel: signed-out sees 4 open (beginner) + 8 locked
ok('signed-out funnel: 4 open / 8 locked',
  count(hub.html, 'data-testid="lesson-open"') === 4 &&
    count(hub.html, 'data-testid="lesson-locked"') === 8,
  `open=${count(hub.html, 'data-testid="lesson-open"')} locked=${count(hub.html, 'data-testid="lesson-locked"')}`)

// English hub
const hubEn = await page('/en/education')
ok('english hub renders', hubEn.status === 200 && hubEn.html.includes('Trading Basics'))

// --- 2. access matrix -------------------------------------------------------------
console.log('--- access matrix ---')
// Signed-out
let res = await page(FREE_LESSON)
ok('signed-out: beginner lesson → open content',
  res.status === 200 && res.html.includes('data-testid="lesson-content"'))
res = await page(MEMBER_LESSON)
ok('signed-out: intermediate lesson → sign-up gate',
  res.html.includes('data-testid="gate-auth"'))
res = await page(STANDARD_LESSON)
ok('signed-out: advanced lesson → sign-up gate first',
  res.html.includes('data-testid="gate-auth"'))

// Signed-in FREE member
await setPlan('FREE')
res = await page(MEMBER_LESSON, true)
ok('FREE member: intermediate lesson → open (sign-up funnel rewarded)',
  res.html.includes('data-testid="lesson-content"'))
res = await page(STANDARD_LESSON, true)
ok('FREE member: advanced lesson → upgrade gate',
  res.html.includes('data-testid="gate-plan"'))

// Hub as FREE member: 8 open / 4 locked
const hubMember = await page('/ko/education', true)
ok('FREE member funnel: 8 open / 4 locked',
  count(hubMember.html, 'data-testid="lesson-open"') === 8 &&
    count(hubMember.html, 'data-testid="lesson-locked"') === 4)

// STANDARD subscriber: everything open
await setPlan('STANDARD')
res = await page(STANDARD_LESSON, true)
ok('STANDARD: advanced lesson → open',
  res.html.includes('data-testid="lesson-content"'))
const hubStandard = await page('/ko/education', true)
ok('STANDARD: all 12 lessons open',
  count(hubStandard.html, 'data-testid="lesson-open"') === 12 &&
    count(hubStandard.html, 'data-testid="lesson-locked"') === 0)

// Higher tiers inherit
await setPlan('INSTITUTIONAL')
res = await page(STANDARD_LESSON, true)
ok('INSTITUTIONAL: advanced lesson → open', res.html.includes('data-testid="lesson-content"'))

// --- 3. content integrity -----------------------------------------------------------
console.log('--- content integrity ---')
res = await page(FREE_LESSON)
ok('lesson renders headings + disclaimer',
  res.html.includes('data-testid="lesson-disclaimer"') && count(res.html, '<h2') >= 3)

const ADVICE = [
  /매수하세요|매도하세요|사세요|파세요|추천합니다|추천드립니다/,
  /\bbuy now\b|\bsell now\b|\byou should (buy|sell)\b|\bwe recommend buying\b/i,
  /수익.{0,6}보장/,
  /guaranteed (profit|return)/i,
]
await setPlan('STANDARD')
let violations = []
for (const slug of [
  'trading-exchange-basics', 'trading-orderbook-liquidity', 'trading-derivatives-structure',
  'technical-chart-reading', 'technical-trend-sr', 'technical-patterns-probability',
  'risk-why-first', 'risk-position-sizing', 'risk-drawdown-metrics',
  'psychology-traps', 'psychology-biases-decisions', 'psychology-discipline-systems',
]) {
  for (const locale of ['ko', 'en']) {
    const lesson = await page(`/${locale}/education/${slug}`, true)
    // Scan lesson content only — strip <script> and the shared <footer>
    // (the site-wide legal disclaimer legitimately says "수익을 보장하지
    // 않습니다", a negated disclaimer, which would otherwise false-positive).
    const body = lesson.html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<footer[\s\S]*?<\/footer>/g, '')
    for (const p of ADVICE) {
      const m = body.match(p)
      if (m) violations.push(`${slug}/${locale}: ${m[0]}`)
    }
  }
}
ok('all 24 lesson pages (12 × ko/en) free of advice-form phrasing',
  violations.length === 0, violations.slice(0, 3).join('; '))

// Note: Next 14 dev returns 200 for nested not-found boundaries (known
// framework behavior) — assert the not-found UI renders instead.
const missing = await page('/ko/education/nonexistent-lesson')
ok('unknown lesson → not-found page rendered',
  missing.html.includes('페이지를 찾을 수 없습니다') || missing.status === 404,
  `status=${missing.status}`)

// --- cleanup ---------------------------------------------------------------------------
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
