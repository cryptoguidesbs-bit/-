import { NextResponse } from 'next/server'

import { nowUtcIso } from '@/lib/datetime'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    // UTC ISO 8601 — clients convert to local time for display.
    timestamp: nowUtcIso(),
  })
}
