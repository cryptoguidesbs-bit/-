import { NextRequest, NextResponse } from 'next/server'

import { canTriggerPipeline } from '@/lib/news/trigger-auth'
import { testControls } from '@/lib/market/request-helpers'
import { seedRegulationsIfEmpty } from '@/lib/map/regulation'
import { syncBtcMap } from '@/lib/map/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/map/sync — refresh MapPlace from BTCMap (incremental) and ensure
// the regulation seed is loaded. Internal: cron secret header or ADMIN.
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { blocked } = testControls(request)
  await seedRegulationsIfEmpty()
  const summary = await syncBtcMap({ blocked })
  return NextResponse.json({ ok: true, summary })
}
