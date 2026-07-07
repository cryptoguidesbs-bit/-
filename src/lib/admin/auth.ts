import 'server-only'

import { NextResponse } from 'next/server'
import type { User } from '@prisma/client'

import { getDbUser } from '@/lib/user'

// Admin route guard: signed-in DB user with the ADMIN role.
export async function requireAdmin(): Promise<
  { ok: true; user: User } | { ok: false; response: NextResponse }
> {
  const user = await getDbUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  if (user.role !== 'ADMIN') {
    return { ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { ok: true, user }
}
