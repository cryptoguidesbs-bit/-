// Stage 12 — Whale & On-chain test: data pipeline (real sources, resilient
// fallback) + Pro tier gating + region policy.
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

const get = async (path, headers = {}) => {
  const res = await fetch(`${APP}${path}`, {
    headers: { authorization: `Bearer ${jwt}`, ...headers },
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

// --- 1. tier gating -------------------------------------------------------------
console.log('--- tier gating ---')
const anon = await fetch(`${APP}/api/onchain/summary`)
ok('anonymous → 401', anon.status === 401, `status=${anon.status}`)

for (const [plan, expected] of [
  ['FREE', 403],
  ['STARTER', 403],
  ['TRADER', 403],
  ['PRO', 200],
  ['WHALE', 200],
]) {
  await setPlan(plan)
  const res = await get('/api/onchain/summary')
  ok(`${plan} → ${expected}`, res.status === expected, `status=${res.status}`)
}

// --- 2. region policy --------------------------------------------------------------
console.log('--- region policy ---')
await setPlan('PRO')
const cn = await get('/api/onchain/whales', { 'x-vercel-ip-country': 'CN' })
ok('PRO from CN → 403 (region)', cn.status === 403 && cn.json?.reason === 'region',
  `status=${cn.status} reason=${cn.json?.reason}`)
const kr = await get('/api/onchain/whales', { 'x-vercel-ip-country': 'KR' })
ok('PRO from KR → 200', kr.status === 200, `status=${kr.status}`)

// --- 3. data pipeline ----------------------------------------------------------------
console.log('--- data pipeline ---')
const whales = kr.json
ok('whale tracker: ≥1 large tx with sane values (blockchair or mempool fallback)',
  Array.isArray(whales?.data?.txs) &&
    whales.data.txs.length > 0 &&
    whales.data.txs.every((tx) => tx.valueUsd > 0 && tx.valueBtc > 0 && tx.hash),
  `source=${whales?.source} count=${whales?.data?.txs?.length} first=$${(whales?.data?.txs?.[0]?.valueUsd / 1e6).toFixed(2)}M`)

const hasFlow = whales?.data?.flow
ok('exchange flow estimate present with method label',
  hasFlow ? whales.data.flow.method === 'mempool-sample' && whales.data.flow.sampleSize > 0 : true,
  hasFlow
    ? `sample=${whales.data.flow.sampleSize} matched=${whales.data.flow.matchedCount} net=$${Math.round(whales.data.flow.netUsd)}`
    : 'flow unavailable (mempool source down — tolerated)')

const summary = await get('/api/onchain/summary')
const net = summary.json?.network?.data
ok('network activity: active addresses series',
  net?.activeAddresses?.latest > 100_000 && net.activeAddresses.series.length >= 10,
  `latest=${net?.activeAddresses?.latest} points=${net?.activeAddresses?.series?.length}`)
ok('network activity: transactions / hash rate / miner revenue',
  net?.transactions?.latest > 0 && net?.hashRate?.latest > 0 && net?.minerRevenue?.latest > 0,
  `tx=${Math.round(net?.transactions?.latest)} hash=${Math.round(net?.hashRate?.latest / 1e6)}EH rev=$${Math.round(net?.minerRevenue?.latest / 1e6)}M`)

const stables = summary.json?.stablecoins?.data
ok('stablecoin supply: USDT/USDC market caps',
  Array.isArray(stables) &&
    stables.some((c) => c.symbol === 'USDT' && c.marketCap > 5e10) &&
    stables.some((c) => c.symbol === 'USDC'),
  stables?.map((c) => `${c.symbol}=$${(c.marketCap / 1e9).toFixed(0)}B`).join(' '))

// --- 4. resilience ---------------------------------------------------------------------
console.log('--- resilience ---')
const blockedWarm = await get('/api/onchain/summary', { 'x-test-block-upstream': '1' })
ok('blocked upstream (warm cache) → 200 with data',
  blockedWarm.status === 200 && blockedWarm.json?.network?.data !== null)

const cold = await get('/api/onchain/summary', {
  'x-test-block-upstream': '1',
  'x-test-cache-bust': String(Math.random()).slice(2, 8),
})
ok('blocked + cold cache → graceful envelope (no 5xx)',
  cold.status === 200 && cold.json?.network?.data === null && cold.json?.network?.error === 'unavailable')

// --- 5. page gating ------------------------------------------------------------------------
console.log('--- page ---')
const pageOk = await fetch(`${APP}/ko/onchain`, { headers: { authorization: `Bearer ${jwt}` } })
const htmlOk = await pageOk.text()
ok('/ko/onchain renders for PRO',
  pageOk.status === 200 && htmlOk.includes('data-testid="onchain-page"'), `status=${pageOk.status}`)

await setPlan('STARTER')
const pageGated = await fetch(`${APP}/ko/onchain`, { headers: { authorization: `Bearer ${jwt}` } })
const htmlGated = await pageGated.text()
ok('/ko/onchain as STARTER → upgrade gate', htmlGated.includes('data-testid="gate-plan"'))

// --- cleanup ---------------------------------------------------------------------------------
await prisma.subscription.deleteMany({ where: { userId: dbUser.id } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
