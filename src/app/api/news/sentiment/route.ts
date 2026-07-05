import { NextResponse } from 'next/server'

import { aggregateSentiment } from '@/lib/news/pipeline'

export const dynamic = 'force-dynamic'

// Aggregated market sentiment over the last 24h of published news.
// Explicitly labeled: this is a NEWS-TONE analysis, not an investment signal.
export async function GET() {
  const sentiment = await aggregateSentiment(24)
  return NextResponse.json(sentiment)
}
