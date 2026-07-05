import 'server-only'

import type { NextRequest } from 'next/server'

// Test hooks (non-production only):
//   x-test-block-upstream: 1  → behave as if every upstream API were down
//   x-test-cache-bust: <v>    → use a separate cache bucket (simulates a
//                               cold start with no last-good value)
export function testControls(request: NextRequest): { blocked: boolean; cacheSuffix: string } {
  if (process.env.NODE_ENV === 'production') return { blocked: false, cacheSuffix: '' }
  const blocked = request.headers.get('x-test-block-upstream') === '1'
  const bust = request.headers.get('x-test-cache-bust')
  return { blocked, cacheSuffix: bust ? `:test-${bust}` : '' }
}
