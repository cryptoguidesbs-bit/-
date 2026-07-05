// Stage 7 — market data + resilience test.
// Proves the completion condition: the service keeps serving even when
// every upstream API is blocked (test hook simulates total outage).
const APP = 'http://localhost:3000'

let passCount = 0
let failCount = 0
const ok = (name, pass, detail = '') => {
  if (pass) passCount++
  else failCount++
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

const get = async (path, headers = {}) => {
  const res = await fetch(`${APP}${path}`, { headers })
  return { status: res.status, json: await res.json().catch(() => null) }
}

// --- 1. normal operation ----------------------------------------------------
console.log('--- normal operation ---')
const prices = await get('/api/market/prices')
ok(
  'crypto prices fresh (BTC/ETH/SOL)',
  prices.status === 200 &&
    prices.json?.stale === false &&
    ['BTC', 'ETH', 'SOL'].every((id) => prices.json?.data?.some((q) => q.id === id && q.price > 0)),
  `source=${prices.json?.source}`,
)

const indices = await get('/api/market/indices')
const wanted = ['NASDAQ', 'SP500', 'KOSPI', 'GOLD', 'OIL', 'DXY']
ok(
  'indices fresh (NASDAQ/S&P500/KOSPI/Gold/Oil/DXY)',
  indices.status === 200 &&
    indices.json?.stale === false &&
    wanted.every((id) => indices.json?.data?.some((q) => q.id === id && q.price > 0)),
  `source=${indices.json?.source} got=${(indices.json?.data ?? []).map((q) => q.id).join(',')}`,
)

const sentiment = await get('/api/market/sentiment')
ok(
  'fear & greed fresh (0–100)',
  sentiment.status === 200 &&
    sentiment.json?.stale === false &&
    sentiment.json?.data?.value >= 0 &&
    sentiment.json?.data?.value <= 100,
  `value=${sentiment.json?.data?.value} (${sentiment.json?.data?.classification})`,
)

// --- 2. total upstream outage → service still serves data --------------------
console.log('--- all upstreams blocked (warm cache) ---')
const blocked = { 'x-test-block-upstream': '1' }

for (const [name, path, reference] of [
  ['prices', '/api/market/prices', prices],
  ['indices', '/api/market/indices', indices],
  ['sentiment', '/api/market/sentiment', sentiment],
]) {
  const res = await get(path, blocked)
  ok(
    `${name}: blocked → 200 with data (service maintained)`,
    res.status === 200 && res.json?.data !== null,
    `stale=${res.json?.stale} hasData=${res.json?.data !== null}`,
  )
  // Values must equal the last good snapshot (not fabricated).
  if (name === 'sentiment') {
    ok(
      'sentiment: served value matches last snapshot',
      res.json?.data?.value === reference.json?.data?.value,
    )
  }
}

// --- 2b. stale fallback path (cache older than freshMs) ----------------------
console.log('--- stale fallback after freshness window (waits ~21s) ---')
await new Promise((r) => setTimeout(r, 21_000)) // prices freshMs = 20s
const stalePrices = await get('/api/market/prices', blocked)
ok(
  'prices: blocked after freshness window → stale:true + last-good data',
  stalePrices.status === 200 &&
    stalePrices.json?.stale === true &&
    Array.isArray(stalePrices.json?.data) &&
    stalePrices.json.data.length === 3,
  `stale=${stalePrices.json?.stale} updatedAt=${stalePrices.json?.updatedAt}`,
)
ok(
  'prices: stale values identical to last snapshot',
  JSON.stringify(stalePrices.json?.data) === JSON.stringify(prices.json?.data),
)

// --- 3. cold start + outage → graceful empty envelope, no 5xx ---------------
console.log('--- blocked with no cache at all (cold start) ---')
const cold = { 'x-test-block-upstream': '1', 'x-test-cache-bust': String(Math.random()).slice(2, 8) }
for (const path of ['/api/market/prices', '/api/market/indices', '/api/market/sentiment']) {
  const res = await get(path, cold)
  ok(
    `${path} cold+blocked → 200 graceful (data:null, error flag)`,
    res.status === 200 && res.json?.data === null && res.json?.error === 'unavailable',
    `status=${res.status}`,
  )
}

// --- 4. page keeps rendering -------------------------------------------------
console.log('--- page availability ---')
const pageRes = await fetch(`${APP}/ko`)
const html = await pageRes.text()
ok(
  'home page renders (200) with market section',
  pageRes.status === 200 && html.includes('id="market"'),
  `status=${pageRes.status}`,
)

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(failCount === 0 ? 0 : 1)
