// ---------------------------------------------------------------------------
// Chart pattern detection — pure, deterministic pivot-based heuristics.
// Confidence is a SHAPE-MATCH score (how well the candles fit the pattern's
// geometric criteria), NOT a prediction of price direction or outcome.
// ---------------------------------------------------------------------------

export type Candle = { t: number; o: number; h: number; l: number; c: number }

export type PatternType =
  | 'triangle'
  | 'flag'
  | 'cup'
  | 'doubleTop'
  | 'doubleBottom'
  | 'headShoulders'

export type DetectedPattern = {
  type: PatternType
  /** Shape-match confidence, 0–100. */
  confidence: number
  /** Measured facts used by the description templates. */
  stats: Record<string, number>
  /** Candle index range the pattern spans. */
  startIndex: number
  endIndex: number
}

export type SrLevel = {
  kind: 'support' | 'resistance'
  price: number
  touches: number
  /** Shape-match confidence, 0–100. */
  confidence: number
}

export type DetectionResult = {
  patterns: DetectedPattern[]
  levels: SrLevel[]
  closes: number[]
}

// --- pivots -----------------------------------------------------------------

function pivotIndices(values: number[], window: number, isHigh: boolean): number[] {
  const out: number[] = []
  for (let i = window; i < values.length - window; i++) {
    let extreme = true
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue
      if (isHigh ? values[j] > values[i] : values[j] < values[i]) {
        extreme = false
        break
      }
    }
    if (extreme) out.push(i)
  }
  return out
}

const pctDiff = (a: number, b: number) => Math.abs(a - b) / ((a + b) / 2)

// --- support / resistance -----------------------------------------------------

function detectLevels(candles: Candle[]): SrLevel[] {
  const highs = candles.map((c) => c.h)
  const lows = candles.map((c) => c.l)
  const lastClose = candles[candles.length - 1].c
  const tolerance = 0.006

  const cluster = (indices: number[], values: number[]): { price: number; touches: number }[] => {
    const clusters: { prices: number[] }[] = []
    for (const index of indices) {
      const price = values[index]
      const existing = clusters.find(
        (c) => pctDiff(c.prices.reduce((s, p) => s + p, 0) / c.prices.length, price) < tolerance,
      )
      if (existing) existing.prices.push(price)
      else clusters.push({ prices: [price] })
    }
    return clusters
      .filter((c) => c.prices.length >= 2)
      .map((c) => ({
        price: c.prices.reduce((s, p) => s + p, 0) / c.prices.length,
        touches: c.prices.length,
      }))
  }

  const levels: SrLevel[] = []
  for (const { price, touches } of cluster(pivotIndices(highs, 3, true), highs)) {
    levels.push({
      kind: price >= lastClose ? 'resistance' : 'support',
      price,
      touches,
      confidence: Math.min(95, 35 + touches * 15),
    })
  }
  for (const { price, touches } of cluster(pivotIndices(lows, 3, false), lows)) {
    levels.push({
      kind: price <= lastClose ? 'support' : 'resistance',
      price,
      touches,
      confidence: Math.min(95, 35 + touches * 15),
    })
  }
  return levels.sort((a, b) => b.confidence - a.confidence).slice(0, 6)
}

// --- double top / bottom --------------------------------------------------------

function detectDouble(candles: Candle[], kind: 'top' | 'bottom'): DetectedPattern | null {
  const values = kind === 'top' ? candles.map((c) => c.h) : candles.map((c) => c.l)
  const pivots = pivotIndices(values, 3, kind === 'top')
  if (pivots.length < 2) return null

  for (let i = pivots.length - 1; i >= 1; i--) {
    const b = pivots[i]
    for (let j = i - 1; j >= 0; j--) {
      const a = pivots[j]
      if (b - a < 8 || b - a > 80) continue
      const diff = pctDiff(values[a], values[b])
      if (diff > 0.02) continue
      // Middle retracement between the two extremes.
      const between = candles.slice(a + 1, b)
      if (between.length === 0) continue
      const mid =
        kind === 'top'
          ? Math.min(...between.map((c) => c.l))
          : Math.max(...between.map((c) => c.h))
      const depth = Math.abs(mid - values[a]) / values[a]
      if (depth < 0.02) continue

      return {
        type: kind === 'top' ? 'doubleTop' : 'doubleBottom',
        confidence: Math.round(
          Math.min(92, 55 + (1 - diff / 0.02) * 20 + Math.min(depth * 100, 12)),
        ),
        stats: {
          first: values[a],
          second: values[b],
          diffPct: diff * 100,
          retracePct: depth * 100,
        },
        startIndex: a,
        endIndex: b,
      }
    }
  }
  return null
}

// --- head & shoulders --------------------------------------------------------------

function detectHeadShoulders(candles: Candle[]): DetectedPattern | null {
  const highs = candles.map((c) => c.h)
  const pivots = pivotIndices(highs, 3, true)
  if (pivots.length < 3) return null

  for (let i = pivots.length - 1; i >= 2; i--) {
    const [l, h, r] = [pivots[i - 2], pivots[i - 1], pivots[i]]
    const [lv, hv, rv] = [highs[l], highs[h], highs[r]]
    if (hv <= lv || hv <= rv) continue
    const shoulderDiff = pctDiff(lv, rv)
    if (shoulderDiff > 0.03) continue
    const headRise = (hv - Math.max(lv, rv)) / Math.max(lv, rv)
    if (headRise < 0.015) continue

    return {
      type: 'headShoulders',
      confidence: Math.round(
        Math.min(90, 50 + (1 - shoulderDiff / 0.03) * 20 + Math.min(headRise * 200, 20)),
      ),
      stats: {
        leftShoulder: lv,
        head: hv,
        rightShoulder: rv,
        shoulderDiffPct: shoulderDiff * 100,
        headRisePct: headRise * 100,
      },
      startIndex: l,
      endIndex: r,
    }
  }
  return null
}

// --- triangle ------------------------------------------------------------------------

function slope(points: { x: number; y: number }[]): number {
  const n = points.length
  const sx = points.reduce((s, p) => s + p.x, 0)
  const sy = points.reduce((s, p) => s + p.y, 0)
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0)
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sxx - sx * sx
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom
}

function detectTriangle(candles: Candle[]): DetectedPattern | null {
  const highs = candles.map((c) => c.h)
  const lows = candles.map((c) => c.l)
  const highPivots = pivotIndices(highs, 3, true).slice(-4)
  const lowPivots = pivotIndices(lows, 3, false).slice(-4)
  if (highPivots.length < 3 || lowPivots.length < 3) return null

  const avgPrice = candles[candles.length - 1].c
  const highSlope =
    slope(highPivots.map((i) => ({ x: i, y: highs[i] }))) / avgPrice
  const lowSlope = slope(lowPivots.map((i) => ({ x: i, y: lows[i] }))) / avgPrice

  // Converging: highs flat-or-falling AND lows flat-or-rising, with real
  // convergence (not two flat lines).
  const converging = highSlope <= 0.0002 && lowSlope >= -0.0002 && lowSlope - highSlope > 0.0006
  if (!converging) return null

  const startIndex = Math.min(highPivots[0], lowPivots[0])
  const endIndex = candles.length - 1
  const startRange = highs[highPivots[0]] - lows[lowPivots[0]]
  const endRange =
    highs[highPivots[highPivots.length - 1]] - lows[lowPivots[lowPivots.length - 1]]
  const compression = startRange > 0 ? 1 - endRange / startRange : 0
  if (compression < 0.2) return null

  return {
    type: 'triangle',
    confidence: Math.round(Math.min(88, 45 + compression * 50)),
    stats: {
      compressionPct: compression * 100,
      highTouches: highPivots.length,
      lowTouches: lowPivots.length,
    },
    startIndex,
    endIndex,
  }
}

// --- flag ------------------------------------------------------------------------------

function detectFlag(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 30) return null
  const closes = candles.map((c) => c.c)
  const n = closes.length

  for (const poleLen of [8, 12, 16]) {
    for (const flagLen of [6, 8, 10]) {
      const poleStart = n - 1 - flagLen - poleLen
      if (poleStart < 0) continue
      const poleReturn = (closes[poleStart + poleLen] - closes[poleStart]) / closes[poleStart]
      if (Math.abs(poleReturn) < 0.05) continue

      const flagCandles = candles.slice(n - 1 - flagLen, n)
      const flagHigh = Math.max(...flagCandles.map((c) => c.h))
      const flagLow = Math.min(...flagCandles.map((c) => c.l))
      const flagRange = (flagHigh - flagLow) / closes[n - 1 - flagLen]
      if (flagRange > Math.abs(poleReturn) * 0.5) continue

      const drift =
        (flagCandles[flagCandles.length - 1].c - flagCandles[0].c) / flagCandles[0].c
      // Consolidation should not extend the pole strongly.
      if (Math.sign(drift) === Math.sign(poleReturn) && Math.abs(drift) > Math.abs(poleReturn) * 0.3)
        continue

      return {
        type: 'flag',
        confidence: Math.round(
          Math.min(85, 45 + Math.min(Math.abs(poleReturn) * 200, 25) + (1 - flagRange / (Math.abs(poleReturn) * 0.5)) * 15),
        ),
        stats: {
          polePct: poleReturn * 100,
          flagRangePct: flagRange * 100,
          poleLen,
          flagLen,
        },
        startIndex: poleStart,
        endIndex: n - 1,
      }
    }
  }
  return null
}

// --- cup --------------------------------------------------------------------------------

function detectCup(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 40) return null
  const closes = candles.map((c) => c.c)
  const n = closes.length

  for (const span of [40, 60, 90]) {
    if (span > n) continue
    const window = closes.slice(n - span)
    const left = window[0]
    const right = window[window.length - 1]
    if (pctDiff(left, right) > 0.03) continue

    const minValue = Math.min(...window)
    const minIndex = window.indexOf(minValue)
    const depth = (Math.min(left, right) - minValue) / Math.min(left, right)
    if (depth < 0.05) continue
    // Bottom roughly in the middle 60% of the window.
    if (minIndex < span * 0.2 || minIndex > span * 0.8) continue

    return {
      type: 'cup',
      confidence: Math.round(
        Math.min(85, 45 + Math.min(depth * 150, 20) + (1 - pctDiff(left, right) / 0.03) * 15),
      ),
      stats: {
        leftRim: left,
        rightRim: right,
        bottom: minValue,
        depthPct: depth * 100,
        spanCandles: span,
      },
      startIndex: n - span,
      endIndex: n - 1,
    }
  }
  return null
}

// --- entry point ---------------------------------------------------------------------------

export function detectPatterns(candles: Candle[]): DetectionResult {
  if (candles.length < 20) {
    return { patterns: [], levels: [], closes: candles.map((c) => c.c) }
  }

  const patterns = [
    detectTriangle(candles),
    detectFlag(candles),
    detectCup(candles),
    detectDouble(candles, 'top'),
    detectDouble(candles, 'bottom'),
    detectHeadShoulders(candles),
  ].filter((p): p is DetectedPattern => p !== null)

  return {
    patterns: patterns.sort((a, b) => b.confidence - a.confidence),
    levels: detectLevels(candles),
    closes: candles.map((c) => c.c),
  }
}
