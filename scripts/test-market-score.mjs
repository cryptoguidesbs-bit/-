// Market Score (v1) — API contract + degradation.
// Proves: score is 0–100 from the published inputs/weights, partial/missing
// inputs are reported (never invented), and a total upstream outage yields
// "not computed" rather than a made-up number.
import { get, getText, ok, summary } from './lib/test-kit.mjs'

const WEIGHTS = {
  momentum: 20,
  marketCap: 15,
  breadth: 15,
  fearGreed: 20,
  newsTone: 20,
  stability: 10,
}
const BANDS = ['cold', 'riskOff', 'neutral', 'riskOn', 'overheated']
const bandOf = (s) =>
  s < 20 ? 'cold' : s < 40 ? 'riskOff' : s < 60 ? 'neutral' : s < 80 ? 'riskOn' : 'overheated'

console.log('--- live score ---')
const live = await get('/api/market/score')
const j = live.json
ok(
  'GET /api/market/score → 200 with v1 envelope',
  live.status === 200 && j?.weightsVersion === 'v1' && Array.isArray(j?.components)
)
ok(
  'six components with the published weights',
  j?.components?.length === 6 && j.components.every((c) => WEIGHTS[c.key] === c.weight),
  j?.components?.map((c) => `${c.key}:${c.weight}`).join(',')
)
ok('weights sum to 100', Object.values(WEIGHTS).reduce((a, b) => a + b, 0) === 100)
const available = (j?.components ?? []).filter((c) => c.available)
ok(
  'at least 3 inputs available live',
  available.length >= 3,
  `available=${available.map((c) => c.key).join(',')} missing=${(j?.missing ?? []).join(',')}`
)
ok(
  'score is an integer 0–100 when computed',
  j?.score === null || (Number.isInteger(j.score) && j.score >= 0 && j.score <= 100),
  `score=${j?.score}`
)
ok(
  'band matches score thresholds',
  (j?.score === null && j?.band === null) ||
    (BANDS.includes(j?.band) && bandOf(j.score) === j.band),
  `band=${j?.band}`
)
ok(
  'every available input is normalized to 0–100',
  available.every((c) => c.normalized >= 0 && c.normalized <= 100 && typeof c.raw === 'number')
)
ok(
  'missing inputs carry null (never a fabricated number)',
  (j?.components ?? [])
    .filter((c) => !c.available)
    .every(
      (c) =>
        c.raw === null &&
        c.normalized === null &&
        c.contribution === null &&
        c.effectiveWeight === null
    )
)
if (j?.score !== null) {
  const sum = available.reduce((s, c) => s + c.contribution, 0)
  ok(
    'contributions add up to the score (±1 rounding)',
    Math.abs(sum - j.score) <= 1.5,
    `sum=${sum.toFixed(1)} score=${j.score}`
  )
  ok('partial flag consistent with missing list', j.partial === j.missing.length > 0)
  const effSum = available.reduce((s, c) => s + c.effectiveWeight, 0)
  ok(
    'effective weights rescale to 100 over available inputs',
    Math.abs(effSum - 100) <= 0.5,
    `effSum=${effSum.toFixed(1)}`
  )
  ok(
    'effective weight ≥ nominal weight (never smaller)',
    available.every((c) => c.effectiveWeight >= c.weight - 0.05)
  )
}
ok('no buy/sell language in the payload', !/\b(buy|sell|long|short)\b/i.test(JSON.stringify(j)))
const tone = (j?.components ?? []).find((c) => c.key === 'newsTone')
ok(
  'news tone reports the sample age, not the compute time',
  !tone?.available ||
    (typeof tone.updatedAt === 'string' && new Date(tone.updatedAt).getTime() <= Date.now()),
  `updatedAt=${tone?.updatedAt}`
)

console.log('--- all upstreams blocked (cold cache) ---')
const cold = {
  'x-test-block-upstream': '1',
  'x-test-cache-bust': String(Math.random()).slice(2, 8),
}
const blocked = await get('/api/market/score', cold)
const b = blocked.json
ok(
  'still a 200 envelope during a total outage',
  blocked.status === 200 && b?.weightsVersion === 'v1'
)
ok(
  'score is NOT computed with insufficient inputs',
  b?.score === null && b?.band === null,
  `score=${b?.score} available=${
    (b?.components ?? [])
      .filter((c) => c.available)
      .map((c) => c.key)
      .join(',') || 'none'
  }`
)
ok(
  'partial=true and missing lists the blocked inputs',
  b?.partial === true && (b?.missing ?? []).length >= 4,
  `missing=${(b?.missing ?? []).join(',')}`
)

console.log('--- pages ---')
for (const path of ['/ko/score', '/en/score']) {
  const res = await getText(path)
  ok(
    `${path} renders (page shell + title)`,
    res.status === 200 && res.text.includes('score-page') && /Market Score/.test(res.text),
    `status=${res.status}`
  )
}

summary()
