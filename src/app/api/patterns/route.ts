import { NextRequest, NextResponse } from 'next/server'

import { checkFeature } from '@/lib/entitlements'
import { resilientFetch } from '@/lib/market/resilient'
import { testControls } from '@/lib/market/request-helpers'
import { detectPatterns } from '@/lib/patterns/detect'
import { describeLevel, describePattern } from '@/lib/patterns/describe'
import {
  klineSources,
  PATTERN_INTERVALS,
  PATTERN_SYMBOLS,
  type PatternInterval,
  type PatternSymbol,
} from '@/lib/patterns/klines'

export const dynamic = 'force-dynamic'

// GET /api/patterns?symbol=BTC&interval=4h — pattern scan over live candles.
// Trader+ (analysis.patterns). Non-personalized: identical output for
// every requester of the same symbol/interval.
export async function GET(request: NextRequest) {
  const gate = await checkFeature('analysis.patterns')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }

  const params = request.nextUrl.searchParams
  const symbol = (params.get('symbol') ?? 'BTC').toUpperCase() as PatternSymbol
  const interval = (params.get('interval') ?? '4h') as PatternInterval
  if (!PATTERN_SYMBOLS.includes(symbol) || !PATTERN_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: 'invalid symbol or interval' }, { status: 400 })
  }

  const { blocked, cacheSuffix } = testControls(request)
  const result = await resilientFetch(
    `klines-${symbol}-${interval}${cacheSuffix}`,
    klineSources(symbol, interval),
    { timeoutMs: 8_000, retries: 1, freshMs: 5 * 60_000, blocked },
  )

  if (!result.data) {
    return NextResponse.json({
      symbol,
      interval,
      available: false,
      stale: result.stale,
      error: 'candles unavailable',
    })
  }

  const detection = detectPatterns(result.data)
  return NextResponse.json({
    symbol,
    interval,
    available: true,
    stale: result.stale,
    updatedAt: result.updatedAt,
    patterns: detection.patterns.map((p) => ({
      type: p.type,
      confidence: p.confidence,
      stats: p.stats,
      description: describePattern(p),
    })),
    levels: detection.levels.map((level) => ({
      ...level,
      description: describeLevel(level),
    })),
    closes: detection.closes,
  })
}
