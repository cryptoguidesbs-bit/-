import { NextRequest, NextResponse } from 'next/server'

import { canTriggerPipeline } from '@/lib/news/trigger-auth'
import { qualifyPendingReferrals } from '@/lib/referral/qualify'

export const dynamic = 'force-dynamic'

// POST /api/referral/qualify — reconciliation sweep: PENDING referrals whose
// referred user now holds an entitled paid subscription become QUALIFIED
// (+commission where the referrer's region allows monetary rewards).
// Internal: cron secret header or ADMIN session. The same qualification also
// runs inline on payment sync; this sweep catches anything missed.
export async function POST(request: NextRequest) {
  if (!(await canTriggerPipeline(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const summary = await qualifyPendingReferrals()
  return NextResponse.json({ ok: true, summary })
}
