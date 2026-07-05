import { NextResponse } from 'next/server'

import { getEntitlements } from '@/lib/entitlements'

// Feature matrix for the current requester. Signed-out visitors get the
// FREE matrix. Used by clients to show/hide gated UI — the server-side
// checks remain the source of truth.
export async function GET() {
  const entitlements = await getEntitlements()
  return NextResponse.json(entitlements)
}
