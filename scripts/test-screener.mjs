// Coin Screener — API contract + degradation (last-good cache, then null).
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

console.log('--- live table ---')
const live = await get('/api/market/screener')
const rows = live.json?.data ?? []
ok('GET /api/market/screener → 200 fresh', live.status === 200 && live.json?.stale === false, `source=${live.json?.source}`)
ok('at least 50 rows', rows.length >= 50, `rows=${rows.length}`)
ok('rank 1 is BTC', rows[0]?.symbol === 'BTC' && rows[0]?.rank === 1, `first=${rows[0]?.symbol}`)
ok('rows ordered by market cap desc', rows.every((r, i) => i === 0 || rows[i - 1].marketCapUsd >= r.marketCapUsd))
ok('numeric fields are finite', rows.every((r) => Number.isFinite(r.price) && r.price > 0 && Number.isFinite(r.volume24hUsd) && Number.isFinite(r.marketCapUsd)))
ok('change fields are number or null (no fabricated zeros for missing)', rows.every((r) => [r.change1hPct, r.change24hPct, r.change7dPct].every((v) => v === null || Number.isFinite(v))))

console.log('--- all upstreams blocked (warm cache → keeps serving) ---')
// Within the 2-minute fresh window the cache answers directly (stale=false);
// after it, the last good value is served with stale=true. Either way rows
// keep flowing during an outage — that is the property under test.
const warm = await get('/api/market/screener', { 'x-test-block-upstream': '1' })
ok('keeps serving rows during an outage (fresh cache or last-good)', warm.status === 200 && (warm.json?.data ?? []).length >= 50, `stale=${warm.json?.stale} rows=${warm.json?.data?.length}`)

console.log('--- all upstreams blocked (cold cache → null, never fake) ---')
const cold = await get('/api/market/screener', { 'x-test-block-upstream': '1', 'x-test-cache-bust': String(Math.random()).slice(2, 8) })
ok('cold outage → 200 envelope with data:null', cold.status === 200 && cold.json?.data === null)

console.log('--- pages ---')
for (const path of ['/ko/screener', '/en/screener']) {
  const res = await fetch(`${APP}${path}`)
  const html = await res.text()
  ok(`${path} renders`, res.status === 200 && html.includes('screener-page') && /Coin Screener/.test(html), `status=${res.status}`)
}

console.log(`\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'FAILURES'}`)
process.exit(failCount === 0 ? 0 : 1)
