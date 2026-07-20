// Stage 17 — Referral test: link/attribution flow, anti-abuse rules
// (self-referral, duplicate IP, self IP, account age, velocity cap),
// qualification + commission, region-gated monetary rewards, leaderboard
// anonymization.
import fs from 'node:fs'
import crypto from 'node:crypto'
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
async function jwtFor(clerkUserId) {
  const session = await clerkApi('/sessions', 'POST', { user_id: clerkUserId })
  const tokenRes = await clerkApi(`/sessions/${session?.id}/tokens`, 'POST', {
    expires_in_seconds: 600,
  })
  return tokenRes?.jwt
}

const createdClerkIds = []
async function createTestUser(slug) {
  const email = `refflow-${slug}+clerk_test@example.com`
  let user = (await clerkApi(`/users?email_address=${encodeURIComponent(email)}`))?.[0]
  if (!user?.id) {
    user = await clerkApi('/users', 'POST', {
      email_address: [email],
      password: `RefFlow!${slug}-${crypto.randomBytes(4).toString('hex')}`,
    })
  }
  if (!user?.id) throw new Error(`could not create clerk user ${slug}: ${JSON.stringify(user)}`)
  createdClerkIds.push(user.id)
  return { clerkId: user.id, email, jwt: await jwtFor(user.id) }
}

// POST /api/consent as a given user, optionally carrying the referral cookie.
async function consent(jwt, { code, ip, country } = {}) {
  const res = await fetch(`${APP}/api/consent`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jwt}`,
      'content-type': 'application/json',
      ...(code ? { cookie: `cg_ref=${code}` } : {}),
      ...(ip ? { 'x-forwarded-for': ip } : {}),
      ...(country ? { 'x-vercel-ip-country': country } : {}),
    },
    body: JSON.stringify({ locale: 'ko' }),
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const api = async (path, { method = 'GET', jwt, headers = {} } = {}) => {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: { ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...headers },
    redirect: 'manual',
  })
  return {
    status: res.status,
    headers: res.headers,
    json: await res.json().catch(() => null),
  }
}
const page = async (path, jwt, headers = {}) => {
  const res = await fetch(`${APP}${path}`, {
    headers: { ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...headers },
  })
  return { status: res.status, html: await res.text() }
}

// --- setup -------------------------------------------------------------------
const usersA = await clerkApi(`/users?email_address=${encodeURIComponent(EMAIL)}`)
const jwtA = await jwtFor(usersA?.[0]?.id)
const userA = await prisma.user.findFirst({ where: { email: EMAIL } })

async function cleanup() {
  const testEmails = { contains: 'refflow-' }
  const fakeEmails = { contains: 'reffake-' }
  await prisma.referralReward.deleteMany({ where: { userId: userA.id } })
  await prisma.referral.deleteMany({ where: { referrerId: userA.id } })
  await prisma.referral.deleteMany({ where: { referredUserId: userA.id } })
  await prisma.user.deleteMany({ where: { OR: [{ email: testEmails }, { email: fakeEmails }] } })
  await prisma.referralCode.deleteMany({ where: { userId: userA.id } })
  await prisma.consentLog.deleteMany({ where: { userId: userA.id, ipAddress: '198.51.100.7' } })
  await prisma.subscription.deleteMany({ where: { userId: userA.id } })
  await prisma.user.update({ where: { id: userA.id }, data: { country: null } })
}
await cleanup()

// --- 1. referral code + landing ------------------------------------------------
console.log('--- code + landing ---')
let res = await api('/api/me/referral')
ok('signed-out → 401', res.status === 401)

res = await api('/api/me/referral', { jwt: jwtA })
const CODE = res.json?.code
ok('my referral code created', res.status === 200 && /^[A-Z2-9]{8}$/.test(CODE ?? ''), `code=${CODE}`)
ok('link contains /r/<code>', res.json?.link?.endsWith(`/r/${CODE}`))
ok('rewardsAllowed without geo header (allowUnknown)', res.json?.rewardsAllowed === true)

res = await api(`/r/${CODE}`)
const setCookie = res.headers.get('set-cookie') ?? ''
ok('landing redirects', res.status === 307 || res.status === 302)
ok('landing sets cg_ref cookie', setCookie.includes(`cg_ref=${CODE}`))

res = await api('/r/ZZZZZZZZ')
ok('unknown code: redirect without cookie',
  (res.status === 307 || res.status === 302) && !(res.headers.get('set-cookie') ?? '').includes('cg_ref'))

res = await api('/api/me/referral', { jwt: jwtA })
ok('click counted', res.json?.clicks >= 1, `clicks=${res.json?.clicks}`)

// --- 2. attribution happy path ------------------------------------------------
console.log('--- attribution ---')
const userB = await createTestUser('b')
res = await consent(userB.jwt, { code: CODE, ip: '203.0.113.5', country: 'KR' })
ok('referred signup consent ok', res.status === 200)

const dbB = await prisma.user.findFirst({ where: { email: userB.email } })
let refB = await prisma.referral.findUnique({ where: { referredUserId: dbB.id } })
ok('referral recorded PENDING', refB?.status === 'PENDING' && refB?.referrerId === userA.id)
ok('signup IP stored as hash only (no raw IP)',
  refB?.ipHash?.length === 64 && !refB?.ipHash?.includes('203.0.113.5'))
ok('country captured on referred user', dbB?.country === 'KR')

await consent(userB.jwt, { code: CODE, ip: '203.0.113.5' })
const countB = await prisma.referral.count({ where: { referredUserId: dbB.id } })
ok('re-consent is idempotent (1 referral)', countB === 1)

// --- 3. anti-abuse rules ---------------------------------------------------------
console.log('--- anti-abuse ---')
// Self-referral: A signs consent carrying their own code.
await consent(jwtA, { code: CODE, ip: '198.51.100.99' })
const selfRow = await prisma.referral.findUnique({ where: { referredUserId: userA.id } })
ok('self-referral → REJECTED (audited)', selfRow?.status === 'REJECTED' && selfRow?.reason === 'self-referral')

// Duplicate IP: another signup from the IP already credited to A.
const userC = await createTestUser('c')
await consent(userC.jwt, { code: CODE, ip: '203.0.113.5' })
const dbC = await prisma.user.findFirst({ where: { email: userC.email } })
const refC = await prisma.referral.findUnique({ where: { referredUserId: dbC.id } })
ok('duplicate signup IP → REJECTED', refC?.status === 'REJECTED' && refC?.reason === 'duplicate-ip')

// Self IP: signup from the referrer's own recorded consent IP.
await prisma.consentLog.create({
  data: {
    userId: userA.id,
    type: 'INVESTMENT_DISCLAIMER',
    version: 'referral-test',
    granted: true,
    ipAddress: '198.51.100.7',
  },
})
const userD = await createTestUser('d')
await consent(userD.jwt, { code: CODE, ip: '198.51.100.7' })
const dbD = await prisma.user.findFirst({ where: { email: userD.email } })
const refD = await prisma.referral.findUnique({ where: { referredUserId: dbD.id } })
ok('signup from referrer own IP → REJECTED', refD?.status === 'REJECTED' && refD?.reason === 'self-ip')

// Account age: an old account cannot be claimed.
const userE = await createTestUser('e')
await consent(userE.jwt, { ip: '203.0.113.60' }) // first consent, no cookie → user created
const dbE = await prisma.user.findFirst({ where: { email: userE.email } })
await prisma.user.update({
  where: { id: dbE.id },
  data: { createdAt: new Date(Date.now() - 30 * 86_400_000) },
})
await consent(userE.jwt, { code: CODE, ip: '203.0.113.61' })
const refE = await prisma.referral.findUnique({ where: { referredUserId: dbE.id } })
ok('existing (old) account → REJECTED', refE?.status === 'REJECTED' && refE?.reason === 'account-age')

// Velocity cap: seed referrals up to the 24h cap, then one more attempt.
const fakeIds = []
for (let i = 0; i < 10; i++) {
  const fake = await prisma.user.create({
    data: { clerkId: `reffake_${i}_${Date.now()}`, email: `reffake-${i}-${Date.now()}@example.com` },
  })
  fakeIds.push(fake.id)
  await prisma.referral.create({
    data: { referrerId: userA.id, referredUserId: fake.id, code: CODE, status: 'PENDING' },
  })
}
const userF = await createTestUser('f')
await consent(userF.jwt, { code: CODE, ip: '203.0.113.77' })
const dbF = await prisma.user.findFirst({ where: { email: userF.email } })
const refF = await prisma.referral.findUnique({ where: { referredUserId: dbF.id } })
ok('velocity cap exceeded → REJECTED', refF?.status === 'REJECTED' && refF?.reason === 'velocity')

// --- 4. qualification + commission ------------------------------------------------
console.log('--- qualification ---')
res = await api('/api/referral/qualify', { method: 'POST' })
ok('qualify without auth → 401', res.status === 401)

// B starts a paid subscription → their referral qualifies, A earns 10%.
await prisma.subscription.create({
  data: { userId: dbB.id, plan: 'TRADER', status: 'ACTIVE' },
})
res = await api('/api/referral/qualify', { method: 'POST', headers: { 'x-cron-secret': CRON } })
ok('qualify sweep ran', res.status === 200 && res.json?.summary?.qualified >= 1,
  JSON.stringify(res.json?.summary))

refB = await prisma.referral.findUnique({ where: { referredUserId: dbB.id } })
ok('referral → QUALIFIED', refB?.status === 'QUALIFIED' && refB?.qualifiedAt != null)
let rewards = await prisma.referralReward.findMany({ where: { userId: userA.id } })
ok('commission = 10% of TRADER monthly ($14.90)',
  rewards.length === 1 && Number(rewards[0].amountUsd) === 14.9, JSON.stringify(rewards.map((r) => Number(r.amountUsd))))

res = await api('/api/referral/qualify', { method: 'POST', headers: { 'x-cron-secret': CRON } })
rewards = await prisma.referralReward.findMany({ where: { userId: userA.id } })
ok('qualify is idempotent (still 1 reward)', rewards.length === 1)

// --- 5. region-gated monetary rewards ------------------------------------------------
console.log('--- region policy ---')
// Referrer in a non-whitelisted country: referral qualifies, no commission.
await prisma.user.update({ where: { id: userA.id }, data: { country: 'CN' } })
await prisma.subscription.create({
  data: { userId: fakeIds[0], plan: 'STARTER', status: 'ACTIVE' },
})
await api('/api/referral/qualify', { method: 'POST', headers: { 'x-cron-secret': CRON } })
const refFake0 = await prisma.referral.findUnique({ where: { referredUserId: fakeIds[0] } })
rewards = await prisma.referralReward.findMany({ where: { userId: userA.id } })
ok('blocked region: QUALIFIED but no commission',
  refFake0?.status === 'QUALIFIED' && rewards.length === 1)

// Whitelisted country accrues normally.
await prisma.user.update({ where: { id: userA.id }, data: { country: 'KR' } })
await prisma.subscription.create({
  data: { userId: fakeIds[1], plan: 'STARTER', status: 'ACTIVE' },
})
await api('/api/referral/qualify', { method: 'POST', headers: { 'x-cron-secret': CRON } })
rewards = await prisma.referralReward.findMany({ where: { userId: userA.id } })
ok('whitelisted region: commission accrues ($5.90)',
  rewards.length === 2 && rewards.some((r) => Number(r.amountUsd) === 5.9))

// Request-side region signal for the UI.
res = await api('/api/me/referral', { jwt: jwtA, headers: { 'x-vercel-ip-country': 'CU' } })
ok('rewardsAllowed=false for blocked request country', res.json?.rewardsAllowed === false)

// --- 6. leaderboard + stats -----------------------------------------------------------
console.log('--- leaderboard ---')
res = await api('/api/referral/leaderboard')
const board = res.json?.leaderboard ?? []
const top = board[0]
ok('leaderboard has qualified referrers', board.length >= 1 && top?.qualified >= 3,
  JSON.stringify(board))
ok('leaderboard names are masked (no raw email/name)',
  board.every((row) => /^.{1,2}\*\*\*$/.test(row.name)) &&
    !JSON.stringify(board).includes('flowtest'))

res = await api('/api/me/referral', { jwt: jwtA })
ok('my stats reflect qualified referrals + rewards',
  res.json?.stats?.qualified >= 3 && res.json?.rewards?.length === 2)

// --- 7. pages -------------------------------------------------------------------------
console.log('--- pages ---')
let pg = await page('/ko/referral')
ok('signed-out page → sign-in gate', pg.html.includes('data-testid="gate-auth"'))
pg = await page('/ko/referral', jwtA)
ok('signed-in page → referral center + disclaimer',
  pg.html.includes('data-testid="referral-page"') && pg.html.includes('data-testid="referral-disclaimer"'))
pg = await page('/ko/referral', jwtA, { 'x-vercel-ip-country': 'CU' })
ok('blocked-region page shows rewards notice',
  pg.html.includes('data-testid="referral-rewards-region-blocked"'))

// --- cleanup ----------------------------------------------------------------------------
await cleanup()
for (const id of createdClerkIds) await clerkApi(`/users/${id}`, 'DELETE')
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
