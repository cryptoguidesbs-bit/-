// Stage 8 — news pipeline test: ingest → summarize → publish, sanity
// filtering (malformed + compliance), search/category/region, sentiment,
// AI labels, and trigger auth.
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
const prisma = new PrismaClient()

let passCount = 0
let failCount = 0
const ok = (name, pass, detail = '') => {
  if (pass) passCount++
  else failCount++
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

const post = async (path, body, headers = {}) => {
  const res = await fetch(`${APP}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': SECRET, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const get = async (path) => {
  const res = await fetch(`${APP}${path}`)
  return { status: res.status, json: await res.json().catch(() => null) }
}

// --- 0. trigger auth ---------------------------------------------------------
console.log('--- trigger auth ---')
const noAuth = await fetch(`${APP}/api/news/ingest`, { method: 'POST' })
ok('ingest without secret → 403', noAuth.status === 403, `status=${noAuth.status}`)

// --- 1. ingest (collection, region balance) ----------------------------------
console.log('--- ingest ---')
const ingest = await post('/api/news/ingest')
ok('ingest succeeds', ingest.status === 200, `status=${ingest.status}`)
const okSources = (ingest.json?.sources ?? []).filter((s) => !s.error)
const failedSources = (ingest.json?.sources ?? []).filter((s) => s.error)
console.log(
  `  sources ok: ${okSources.map((s) => `${s.name}(${s.region}:${s.fetched})`).join(', ')}`,
)
if (failedSources.length) {
  console.log(`  sources failed: ${failedSources.map((s) => `${s.name}: ${s.error}`).join('; ')}`)
}
const totalInDb = await prisma.newsItem.count()
ok('articles stored in DB', totalInDb > 0, `count=${totalInDb}`)

const regions = await prisma.newsItem.groupBy({ by: ['region'], _count: true })
ok(
  'region balance: ≥2 regions represented',
  regions.length >= 2,
  regions.map((r) => `${r.region}=${r._count}`).join(', '),
)

// --- 2. summarize (AI + sanity + publish) -------------------------------------
console.log('--- summarize ---')
const summarize = await post('/api/news/summarize', { limit: 12 })
ok(
  'summarize publishes articles',
  summarize.status === 200 && summarize.json?.published > 0,
  JSON.stringify(summarize.json),
)

const published = await prisma.newsItem.findFirst({ where: { aiStatus: 'PUBLISHED' } })
ok(
  'published article has full AI enrichment',
  !!published?.summaryKo &&
    !!published?.summaryEn &&
    !!published?.sentiment &&
    published?.confidence >= 0 &&
    published?.confidence <= 100 &&
    !!published?.aiModel,
  `model=${published?.aiModel} sentiment=${published?.sentiment} conf=${published?.confidence}`,
)

// --- 3. sanity check: malformed output → retry then HELD ----------------------
console.log('--- sanity filtering ---')
await prisma.newsItem.deleteMany({ where: { urlHash: { startsWith: 'test-' } } })
await prisma.newsItem.create({
  data: {
    urlHash: 'test-malformed',
    title: '[[MALFORMED]] Bitcoin update test article',
    url: 'https://example.com/malformed',
    source: 'TestFeed',
    region: 'GLOBAL',
    category: 'GENERAL',
    publishedAt: new Date(),
  },
})
await prisma.newsItem.create({
  data: {
    urlHash: 'test-advice',
    title: '[[ADVICE]] Ethereum outlook test article',
    url: 'https://example.com/advice',
    source: 'TestFeed',
    region: 'GLOBAL',
    category: 'GENERAL',
    publishedAt: new Date(),
  },
})

await post('/api/news/summarize', { limit: 20 })

const malformed = await prisma.newsItem.findUnique({ where: { urlHash: 'test-malformed' } })
ok(
  'malformed AI output → HELD after retries (not published)',
  malformed?.aiStatus === 'HELD' && malformed?.aiAttempts >= 2 && !malformed?.summaryKo,
  `status=${malformed?.aiStatus} attempts=${malformed?.aiAttempts} reason="${malformed?.aiHoldReason}"`,
)

const advice = await prisma.newsItem.findUnique({ where: { urlHash: 'test-advice' } })
ok(
  'compliance-violating output → HELD (advice/guarantee filtered)',
  advice?.aiStatus === 'HELD' && /compliance/.test(advice?.aiHoldReason ?? ''),
  `status=${advice?.aiStatus} reason="${advice?.aiHoldReason}"`,
)

// --- 4. list API: held items expose no summary --------------------------------
const heldList = await get('/api/news?query=test article')
const heldItem = heldList.json?.items?.find((i) => i.title.includes('[[MALFORMED]]'))
ok(
  'held item listed without summary (aiGenerated=false)',
  heldItem && heldItem.summaryKo === null && heldItem.aiGenerated === false,
  `aiStatus=${heldItem?.aiStatus}`,
)

// --- 5. search / category / region filters ------------------------------------
console.log('--- search & filters ---')
const anyItem = await prisma.newsItem.findFirst({
  where: { aiStatus: 'PUBLISHED' },
  select: { title: true },
})
const word = (anyItem?.title ?? '').split(' ').find((w) => w.length >= 5) ?? 'bitcoin'
const search = await get(`/api/news?query=${encodeURIComponent(word)}`)
ok(
  `search "${word}" returns only matching titles`,
  search.status === 200 &&
    search.json.items.length > 0 &&
    search.json.items.every((i) => i.title.toLowerCase().includes(word.toLowerCase())),
  `hits=${search.json?.items?.length}`,
)

const catRows = await prisma.newsItem.groupBy({ by: ['category'], _count: true })
const someCat = catRows.sort((a, b) => b._count - a._count)[0]?.category ?? 'GENERAL'
const catRes = await get(`/api/news?category=${someCat}`)
ok(
  `category filter (${someCat}) returns only that category`,
  catRes.json.items.length > 0 && catRes.json.items.every((i) => i.category === someCat),
  `hits=${catRes.json?.items?.length}`,
)

const someRegion = regions[0]?.region ?? 'US'
const regionRes = await get(`/api/news?region=${someRegion}`)
ok(
  `region filter (${someRegion}) returns only that region`,
  regionRes.json.items.length > 0 && regionRes.json.items.every((i) => i.region === someRegion),
  `hits=${regionRes.json?.items?.length}`,
)

// --- 6. market sentiment (news tone) ------------------------------------------
console.log('--- sentiment ---')
const sentiment = await get('/api/news/sentiment')
ok(
  'sentiment: label + confidence + labeled as news-tone',
  ['bullish', 'neutral', 'bearish'].includes(sentiment.json?.label) &&
    sentiment.json?.confidence >= 0 &&
    sentiment.json?.confidence <= 100 &&
    sentiment.json?.method === 'news-tone' &&
    sentiment.json?.sampleSize > 0,
  JSON.stringify(sentiment.json),
)

// --- 7. news page renders -------------------------------------------------------
const page = await fetch(`${APP}/ko/news`)
const html = await page.text()
ok(
  '/ko/news renders (200) with page skeleton',
  page.status === 200 && html.includes('data-testid="news-page"'),
  `status=${page.status}`,
)

// --- cleanup test rows ----------------------------------------------------------
await prisma.newsItem.deleteMany({ where: { urlHash: { startsWith: 'test-' } } })
await prisma.$disconnect()

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
