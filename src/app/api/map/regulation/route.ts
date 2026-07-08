import { NextResponse } from 'next/server'

import { getRegulations } from '@/lib/map/regulation'
import { getDbUser } from '@/lib/user'

export const dynamic = 'force-dynamic'

// GET /api/map/regulation — country regulation badges/legend (our managed
// data). Informational only; not legal advice.
export async function GET() {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const regulations = await getRegulations()
  return NextResponse.json({ regulations })
}
