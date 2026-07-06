import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { detectPatterns, type Candle } from '@/lib/patterns/detect'
import { describeLevel, describePattern } from '@/lib/patterns/describe'

export const dynamic = 'force-dynamic'

const candleSchema = z.object({
  t: z.number(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
})

// Non-production only: run the detector over caller-provided synthetic
// candles. Used by the automated test suite to verify detection correctness
// on planted patterns.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as { candles?: unknown }
  const parsed = z.array(candleSchema).min(20).max(500).safeParse(body.candles)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid candles' }, { status: 400 })
  }

  const detection = detectPatterns(parsed.data as Candle[])
  return NextResponse.json({
    patterns: detection.patterns.map((p) => ({
      type: p.type,
      confidence: p.confidence,
      stats: p.stats,
      description: describePattern(p),
    })),
    levels: detection.levels.map((level) => ({ ...level, description: describeLevel(level) })),
  })
}
