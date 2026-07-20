// Stage 16 — Alert system test: plan gating, rule/channel CRUD, engine run
// (delivery per channel, cooldown, plan re-check) and the event-notification
// guideline filter (no action directives ever delivered).
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
const CRON = process.env.CRON_SECRET
const prisma = new PrismaClient()

let passCount = 0
let failCount = 0
const ok = (name, pass, detail = '') => {
  if (pass) passCount++
  else failCount++
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

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

const api = async (path, { method = 'GET', body, authed = true, headers = {} } = {}) => {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: {
      ...(authed && jwt ? { authorization: `Bearer ${jwt}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const page = async (path, authed = false) => {
  const res = await fetch(`${APP}${path}`, {
    headers: authed ? { authorization: `Bearer ${jwt}` } : {},
  })
  return { status: res.status, html: await res.text() }
}

async function cleanupAlerts() {
  await prisma.alertDelivery.deleteMany({ where: { userId: dbUser.id } })
  await prisma.alertRule.deleteMany({ where: { userId: dbUser.id } })
  await prisma.alertChannelConfig.deleteMany({ where: { userId: dbUser.id } })
  await prisma.notification.deleteMany({ where: { userId: dbUser.id, type: 'ALERT' } })
}
await cleanupAlerts()

// --- 1. plan gating ---------------------------------------------------------
console.log('--- plan gating ---')
let res = await api('/api/me/alerts', { authed: false })
ok('signed-out: list rules → 401', res.status === 401)

const pricePayload = {
  type: 'PRICE',
  channel: 'INAPP',
  params: { symbol: 'BTC', direction: 'above', threshold: 1 },
}
await setPlan('FREE')
res = await api('/api/me/alerts', { method: 'POST', body: pricePayload })
ok('FREE: create rule → 403 (plan)', res.status === 403 && res.json?.reason === 'plan')

await setPlan('STARTER')
res = await api('/api/me/alerts', { method: 'POST', body: pricePayload })
ok('STARTER: create rule → 403 (Trader required)',
  res.status === 403 && res.json?.requiredPlan === 'TRADER')

await setPlan('TRADER')
res = await api('/api/me/alerts', { method: 'POST', body: pricePayload })
ok('TRADER: create rule → 201', res.status === 201 && res.json?.rule?.id)
const priceRuleId = res.json?.rule?.id

// Page gates
const pageOut = await page('/ko/alerts')
ok('signed-out page → sign-in gate', pageOut.html.includes('data-testid="gate-auth"'))
await setPlan('FREE')
const pageFree = await page('/ko/alerts', true)
ok('FREE page → upgrade gate', pageFree.html.includes('data-testid="gate-plan"'))
await setPlan('TRADER')
const pagePro = await page('/ko/alerts', true)
ok('TRADER page → alert center + disclaimer',
  pagePro.html.includes('data-testid="alerts-page"') &&
    pagePro.html.includes('data-testid="alerts-disclaimer"'))

// --- 2. rule CRUD + validation -----------------------------------------------
console.log('--- rule CRUD ---')
res = await api('/api/me/alerts', {
  method: 'POST',
  body: { type: 'PRICE', channel: 'INAPP', params: { symbol: 'BTC', direction: 'above', threshold: -5 } },
})
ok('invalid PRICE params (negative threshold) → 400', res.status === 400)

res = await api('/api/me/alerts', {
  method: 'POST',
  body: { type: 'PATTERN', channel: 'INAPP', params: { symbol: 'DOGE', interval: '4h', minConfidence: 50 } },
})
ok('invalid PATTERN symbol → 400', res.status === 400)

res = await api('/api/me/alerts', {
  method: 'POST',
  body: { type: 'MACRO', channel: 'INAPP', params: { low: 80, high: 20 } },
})
ok('invalid MACRO range (low ≥ high) → 400', res.status === 400)

res = await api('/api/me/alerts', {
  method: 'POST',
  body: { type: 'WHALE', channel: 'EMAIL', params: { minUsd: 500000 } },
})
ok('create WHALE rule → 201', res.status === 201)
const whaleRuleId = res.json?.rule?.id

res = await api('/api/me/alerts', {
  method: 'POST',
  body: { type: 'MACRO', channel: 'TELEGRAM', params: { low: 99, high: 100 } },
})
ok('create MACRO rule → 201', res.status === 201)
const macroRuleId = res.json?.rule?.id

res = await api('/api/me/alerts')
ok('list rules → 3', res.status === 200 && res.json?.rules?.length === 3)

res = await api(`/api/me/alerts/${priceRuleId}`, { method: 'PATCH', body: { active: false } })
ok('PATCH active=false', res.status === 200 && res.json?.rule?.active === false)
res = await api(`/api/me/alerts/${priceRuleId}`, { method: 'PATCH', body: { active: true } })
ok('PATCH active=true', res.status === 200 && res.json?.rule?.active === true)

res = await api(`/api/me/alerts/${whaleRuleId}`, { method: 'DELETE' })
ok('DELETE rule', res.status === 200)
res = await api(`/api/me/alerts/${whaleRuleId}`, { method: 'DELETE' })
ok('DELETE again → 404', res.status === 404)

// --- 3. channel configuration ---------------------------------------------------
console.log('--- channel config ---')
res = await api('/api/me/alerts/channels', {
  method: 'PUT',
  body: { channel: 'TELEGRAM', config: { chatId: '123456789' } },
})
ok('PUT telegram config', res.status === 200)

res = await api('/api/me/alerts/channels', {
  method: 'PUT',
  body: { channel: 'TELEGRAM', config: { chatId: 'not-a-chat-id' } },
})
ok('invalid telegram chatId → 400', res.status === 400)

res = await api('/api/me/alerts/channels', {
  method: 'PUT',
  body: { channel: 'EMAIL', config: { address: 'alerts@example.com' } },
})
ok('PUT email config', res.status === 200)

res = await api('/api/me/alerts/channels', {
  method: 'PUT',
  body: { channel: 'INAPP', config: {} },
})
ok('INAPP is not configurable → 400', res.status === 400)

res = await api('/api/me/alerts/channels')
ok('list channels → 2 configured', res.json?.channels?.length === 2)

// --- 4. engine run: auth + delivery ------------------------------------------------
console.log('--- engine run ---')
res = await api('/api/alerts/run', { method: 'POST', authed: false })
ok('run without auth → 401', res.status === 401)

res = await api('/api/alerts/run', {
  method: 'POST',
  authed: false,
  headers: { 'x-cron-secret': CRON },
})
ok('run with cron secret → 200 + summary', res.status === 200 && res.json?.summary)
const run1 = res.json?.summary
// PRICE (BTC ≥ $1, INAPP) and MACRO (≤99 or ≥100, TELEGRAM) both always fire.
ok('PRICE + MACRO rules fired and sent', run1?.sent >= 2, JSON.stringify(run1))

const deliveries = await prisma.alertDelivery.findMany({ where: { userId: dbUser.id } })
const inappDelivery = deliveries.find((d) => d.channel === 'INAPP' && d.type === 'PRICE')
ok('INAPP delivery recorded SENT (live)',
  inappDelivery?.status === 'SENT' && inappDelivery?.transport === 'live')
const telegramDelivery = deliveries.find((d) => d.channel === 'TELEGRAM' && d.type === 'MACRO')
ok('TELEGRAM delivery recorded SENT via dev transport (no bot token)',
  telegramDelivery?.status === 'SENT' && telegramDelivery?.transport === 'dev')

const notif = await prisma.notification.findFirst({
  where: { userId: dbUser.id, type: 'ALERT' },
})
ok('in-app Notification row created (type ALERT)',
  notif && notif.title.includes('가격 알림'))

// Delivery text is event-notification form: factual + disclaimer, no directives.
const DIRECTIVES = [
  /매수하세요|매도하세요|사세요|파세요|추천합니다|리밸런싱하세요/,
  /진입가|목표가|손절가/,
  /\b(buy|sell)\s+now\b|\byou\s+should\s+(buy|sell)\b|\bwe\s+recommend\b/i,
  /수익.{0,6}보장|guaranteed\s+(profit|return)/i,
]
const sentTexts = deliveries.filter((d) => d.status === 'SENT').map((d) => `${d.title} ${d.body}`)
ok('sent messages contain no directive phrasing',
  sentTexts.length > 0 && sentTexts.every((t) => DIRECTIVES.every((p) => !p.test(t))))
ok('sent messages carry the disclaimer',
  sentTexts.every((t) => t.includes('투자 권유가 아닙니다')))

// --- 5. cooldown ---------------------------------------------------------------
console.log('--- cooldown ---')
const before = await prisma.alertDelivery.count({ where: { userId: dbUser.id } })
res = await api('/api/alerts/run', {
  method: 'POST',
  authed: false,
  headers: { 'x-cron-secret': CRON },
})
const run2 = res.json?.summary
const after = await prisma.alertDelivery.count({ where: { userId: dbUser.id } })
ok('second run: rules in cooldown, nothing re-sent',
  run2?.cooldown >= 2 && run2?.sent === 0 && after === before, JSON.stringify(run2))

// --- 6. guideline filter blocks directive output --------------------------------
console.log('--- guideline filter ---')
await prisma.alertRule.update({ where: { id: priceRuleId }, data: { lastFiredAt: null } })
res = await api('/api/alerts/run', {
  method: 'POST',
  authed: false,
  headers: { 'x-cron-secret': CRON, 'x-test-directive-suffix': 'You should buy now.' },
})
const run3 = res.json?.summary
const skipped = await prisma.alertDelivery.findFirst({
  where: { userId: dbUser.id, ruleId: priceRuleId, status: 'SKIPPED' },
  orderBy: { createdAt: 'desc' },
})
ok('directive text → delivery SKIPPED, nothing sent',
  run3?.skipped >= 1 && run3?.sent === 0 && skipped?.error?.startsWith('guideline:'),
  JSON.stringify(run3))

// --- 7. unconfigured channel is skipped -------------------------------------------
console.log('--- unconfigured channel ---')
await api('/api/me/alerts/channels', { method: 'DELETE', body: { channel: 'TELEGRAM' } })
await prisma.alertRule.update({ where: { id: macroRuleId }, data: { lastFiredAt: null } })
res = await api('/api/alerts/run', {
  method: 'POST',
  authed: false,
  headers: { 'x-cron-secret': CRON },
})
const noConfig = await prisma.alertDelivery.findFirst({
  where: { userId: dbUser.id, ruleId: macroRuleId, status: 'SKIPPED' },
  orderBy: { createdAt: 'desc' },
})
ok('telegram config removed → delivery SKIPPED (channel not configured)',
  noConfig?.error === 'channel not configured')

// --- 8. lapsed plan stops deliveries ------------------------------------------------
console.log('--- plan re-check at send time ---')
await setPlan('FREE')
await prisma.alertRule.updateMany({ where: { userId: dbUser.id }, data: { lastFiredAt: null } })
const beforeLapse = await prisma.alertDelivery.count({ where: { userId: dbUser.id } })
res = await api('/api/alerts/run', {
  method: 'POST',
  authed: false,
  headers: { 'x-cron-secret': CRON },
})
const run4 = res.json?.summary
const afterLapse = await prisma.alertDelivery.count({ where: { userId: dbUser.id } })
ok('lapsed subscription → rules plan-blocked, no deliveries',
  run4?.planBlocked >= 2 && afterLapse === beforeLapse, JSON.stringify(run4))

// --- cleanup ---------------------------------------------------------------------------
await cleanupAlerts()
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
