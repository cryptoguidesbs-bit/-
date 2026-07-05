// Stage 10 — personal dashboard CRUD test: watchlist, portfolio (gated),
// saved articles/reports, notifications, auth boundaries.
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
if (!jwt) {
  console.error('no session token')
  process.exit(1)
}
const H = { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' }
const api = async (path, method = 'GET', body, headers = H) => {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
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
    update: { plan, status: 'ACTIVE' },
    create: { userId: dbUser.id, plan, status: 'ACTIVE' },
  })
}

// Clean slate
await prisma.watchlistItem.deleteMany({ where: { watchlist: { userId: dbUser.id } } })
await prisma.portfolioItem.deleteMany({ where: { portfolio: { userId: dbUser.id } } })
await prisma.savedArticle.deleteMany({ where: { userId: dbUser.id } })
await prisma.savedReport.deleteMany({ where: { userId: dbUser.id } })
await prisma.notification.deleteMany({ where: { userId: dbUser.id } })

// --- 0. auth boundaries -------------------------------------------------------
console.log('--- auth boundaries ---')
for (const path of ['/api/me/watchlist', '/api/me/saved-articles', '/api/me/notifications']) {
  const res = await fetch(`${APP}${path}`)
  ok(`${path} unauthenticated → 401`, res.status === 401, `status=${res.status}`)
}
const pageRes = await fetch(`${APP}/ko/dashboard`, { redirect: 'manual' })
ok('/ko/dashboard unauthenticated → redirect to sign-in',
  pageRes.status === 307 && (pageRes.headers.get('location') ?? '').includes('/sign-in'),
  `status=${pageRes.status}`)

// --- 1. watchlist CRUD ----------------------------------------------------------
console.log('--- watchlist ---')
let res = await api('/api/me/watchlist', 'POST', { symbol: 'btc' })
ok('add BTC (lowercase normalized) → 201', res.status === 201 && res.json?.item?.symbol === 'BTC')
res = await api('/api/me/watchlist', 'POST', { symbol: 'ETH' })
ok('add ETH → 201', res.status === 201)
res = await api('/api/me/watchlist', 'POST', { symbol: 'BTC' })
ok('duplicate BTC → 409', res.status === 409, `status=${res.status}`)
res = await api('/api/me/watchlist', 'POST', { symbol: '!!bad!!' })
ok('invalid symbol → 400', res.status === 400)

res = await api('/api/me/watchlist')
const btcItem = res.json?.items?.find((i) => i.symbol === 'BTC')
ok('list contains BTC+ETH with live price', res.json?.items?.length === 2 &&
  typeof btcItem?.price === 'number' && btcItem.price > 0,
  `price=${btcItem?.price}`)

res = await api(`/api/me/watchlist/${btcItem.id}`, 'DELETE')
const after = await api('/api/me/watchlist')
ok('delete BTC → gone', res.status === 200 && after.json?.items?.length === 1)
res = await api(`/api/me/watchlist/${btcItem.id}`, 'DELETE')
ok('delete again → 404', res.status === 404)

// --- 2. portfolio CRUD (Professional gate) ---------------------------------------
console.log('--- portfolio ---')
await setPlan('FREE')
res = await api('/api/me/portfolio')
ok('portfolio as FREE → 403 (plan gate)', res.status === 403, `status=${res.status}`)

await setPlan('PROFESSIONAL')
res = await api('/api/me/portfolio', 'POST', { symbol: 'BTC', quantity: 0.5, avgCost: 30000 })
ok('add holding BTC 0.5 @ 30000 → 201', res.status === 201)
res = await api('/api/me/portfolio', 'POST', { symbol: 'SOL', quantity: 10, avgCost: 100 })
ok('add holding SOL → 201', res.status === 201)

res = await api('/api/me/portfolio')
const btcHolding = res.json?.items?.find((i) => i.symbol === 'BTC')
ok('portfolio lists holdings with live valuation',
  res.json?.items?.length === 2 &&
    btcHolding?.quantity === 0.5 &&
    typeof btcHolding?.value === 'number' &&
    btcHolding.value > 0 &&
    res.json?.totalValue > 0,
  `value=${btcHolding?.value?.toFixed(2)} total=${res.json?.totalValue?.toFixed(2)}`)

res = await api(`/api/me/portfolio/${btcHolding.id}`, 'PATCH', { quantity: 1.5 })
const patched = await api('/api/me/portfolio')
ok('PATCH quantity 0.5 → 1.5',
  res.status === 200 && patched.json?.items?.find((i) => i.symbol === 'BTC')?.quantity === 1.5)

res = await api(`/api/me/portfolio/${btcHolding.id}`, 'DELETE')
const afterDel = await api('/api/me/portfolio')
ok('DELETE holding → gone', res.status === 200 && afterDel.json?.items?.length === 1)

// upsert semantics: re-adding same symbol replaces
await api('/api/me/portfolio', 'POST', { symbol: 'SOL', quantity: 20, avgCost: 120 })
const upserted = await api('/api/me/portfolio')
ok('re-add same symbol upserts (no duplicate)',
  upserted.json?.items?.length === 1 && upserted.json?.items?.[0]?.quantity === 20)

// --- 3. saved articles CRUD --------------------------------------------------------
console.log('--- saved articles ---')
const article = await prisma.newsItem.findFirst({ orderBy: { publishedAt: 'desc' } })
res = await api('/api/me/saved-articles', 'POST', { newsItemId: article.id })
ok('save article → 201', res.status === 201)
res = await api('/api/me/saved-articles', 'POST', { newsItemId: article.id })
ok('save again → idempotent 201', res.status === 201)
res = await api('/api/me/saved-articles', 'POST', { newsItemId: 'nonexistent' })
ok('save unknown article → 404', res.status === 404)

res = await api('/api/me/saved-articles')
ok('saved list contains article with details',
  res.json?.items?.length === 1 && res.json.items[0].title === article.title)

res = await api(`/api/me/saved-articles/${article.id}`, 'DELETE')
const savedAfter = await api('/api/me/saved-articles')
ok('unsave → gone', res.status === 200 && savedAfter.json?.items?.length === 0)

// --- 4. saved reports CRUD -----------------------------------------------------------
console.log('--- saved reports ---')
const report = await prisma.report.upsert({
  where: { slug_locale: { slug: 'test-report', locale: 'ko' } },
  update: {},
  create: {
    slug: 'test-report',
    locale: 'ko',
    title: '테스트 리포트',
    content: 'placeholder',
    status: 'PUBLISHED',
  },
})
res = await api('/api/me/saved-reports', 'POST', { reportId: report.id })
ok('save report → 201', res.status === 201)
res = await api('/api/me/saved-reports')
ok('saved reports list contains it', res.json?.items?.[0]?.title === '테스트 리포트')
res = await api(`/api/me/saved-reports/${report.id}`, 'DELETE')
const reportsAfter = await api('/api/me/saved-reports')
ok('unsave report → gone', res.status === 200 && reportsAfter.json?.items?.length === 0)

// --- 5. notifications ------------------------------------------------------------------
console.log('--- notifications ---')
await prisma.notification.createMany({
  data: [
    { userId: dbUser.id, title: '알림 1', type: 'SYSTEM' },
    { userId: dbUser.id, title: '알림 2', type: 'BRIEF', body: '새 브리핑이 발행되었습니다.' },
  ],
})
res = await api('/api/me/notifications')
ok('list notifications (2 unread)', res.json?.items?.length === 2 && res.json?.unreadCount === 2)

res = await api('/api/me/notifications/read', 'POST', { all: true })
const readAfter = await api('/api/me/notifications')
ok('mark all read → unread 0',
  res.json?.updated === 2 && readAfter.json?.unreadCount === 0)

const oneId = readAfter.json.items[0].id
res = await api(`/api/me/notifications/${oneId}`, 'DELETE')
const delAfter = await api('/api/me/notifications')
ok('delete notification → 1 left', res.status === 200 && delAfter.json?.items?.length === 1)

// ownership: another user's notification can't be deleted
const otherUser = await prisma.user.upsert({
  where: { clerkId: 'user_test_other' },
  update: {},
  create: { clerkId: 'user_test_other', email: 'other@example.com' },
})
const otherNotif = await prisma.notification.create({
  data: { userId: otherUser.id, title: '남의 알림' },
})
res = await api(`/api/me/notifications/${otherNotif.id}`, 'DELETE')
ok("cannot delete another user's notification → 404", res.status === 404)

// --- 6. dashboard page renders (authed) ---------------------------------------------
const dash = await fetch(`${APP}/ko/dashboard`, { headers: { authorization: `Bearer ${jwt}` } })
const html = await dash.text()
ok('/ko/dashboard renders for member', dash.status === 200 && html.includes('data-testid="dashboard-page"'),
  `status=${dash.status}`)

// --- cleanup ---------------------------------------------------------------------------
await prisma.notification.deleteMany({ where: { userId: { in: [dbUser.id, otherUser.id] } } })
await prisma.savedReport.deleteMany({ where: { userId: dbUser.id } })
await prisma.report.delete({ where: { id: report.id } }).catch(() => {})
await prisma.user.delete({ where: { id: otherUser.id } }).catch(() => {})
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
