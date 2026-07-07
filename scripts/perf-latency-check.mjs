// Stage 20 — CDN region latency check.
//
// Measures TTFB (time to first byte) for a set of URLs, N samples each, and
// reports p50/p95/min/max. Run it against the deployed origin from — or
// pointed at — each target continent to confirm the CDN/edge is serving
// nearby regions within budget.
//
//   node scripts/perf-latency-check.mjs                 # localhost:3000
//   node scripts/perf-latency-check.mjs https://cryptoguide.example
//   SAMPLES=30 node scripts/perf-latency-check.mjs https://... /ko /ko/news
//
// Target continents (see src/config/features region whitelists): the app
// targets KR/JP/SG (APAC), US/CA (Americas), and GB/DE/FR/NL (Europe).
// Recommended Vercel/edge regions: icn1 (Seoul), hnd1 (Tokyo), sin1
// (Singapore), iad1 (US-East), fra1 (Frankfurt).

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const paths = process.argv.slice(3)
const PATHS = paths.length ? paths : ['/ko', '/en', '/ko/news', '/api/health']
const SAMPLES = Number(process.env.SAMPLES) || 12
// TTFB budget (ms) — "good" per web.dta guidance for a nearby edge.
const BUDGET_MS = Number(process.env.BUDGET_MS) || 800

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function timeTtfb(url) {
  const start = process.hrtime.bigint()
  const res = await fetch(url, { cache: 'no-store' })
  // First byte: await the reader's first chunk, not the whole body.
  const reader = res.body?.getReader()
  if (reader) {
    await reader.read()
    await reader.cancel().catch(() => {})
  }
  const end = process.hrtime.bigint()
  return { ms: Number(end - start) / 1e6, status: res.status }
}

console.log(`Latency check → ${base}  (${SAMPLES} samples/path, budget ${BUDGET_MS}ms)\n`)
let worst = 0
let anyFail = false

for (const path of PATHS) {
  const url = `${base}${path}`
  const samples = []
  let status = 0
  // one warm-up (not counted) to prime connection/TLS
  try {
    await timeTtfb(url)
  } catch {
    console.log(`${path.padEnd(20)}  UNREACHABLE`)
    anyFail = true
    continue
  }
  for (let i = 0; i < SAMPLES; i++) {
    try {
      const r = await timeTtfb(url)
      status = r.status
      samples.push(r.ms)
    } catch {
      /* skip failed sample */
    }
  }
  samples.sort((a, b) => a - b)
  const p50 = percentile(samples, 50)
  const p95 = percentile(samples, 95)
  worst = Math.max(worst, p95)
  const within = p95 <= BUDGET_MS
  if (!within) anyFail = true
  console.log(
    `${path.padEnd(20)} [${status}]  p50 ${p50.toFixed(0)}ms  p95 ${p95.toFixed(0)}ms  ` +
      `min ${(samples[0] ?? 0).toFixed(0)}ms  max ${(samples[samples.length - 1] ?? 0).toFixed(0)}ms  ` +
      `${within ? 'OK' : 'OVER BUDGET'}`,
  )
}

console.log(`\nWorst p95: ${worst.toFixed(0)}ms — ${anyFail ? 'SOME OVER BUDGET' : 'ALL WITHIN BUDGET'}`)
process.exit(anyFail ? 1 : 0)
