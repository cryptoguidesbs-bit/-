import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

import { logSecurityEvent } from '@/lib/security/audit'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// DELETE /api/me/account — GDPR right to erasure. Requires an explicit
// confirmation token in the body, deletes our DB row (cascades every related
// record) and the Clerk identity. An anonymized audit entry is written
// BEFORE deletion so the erasure itself is traceable without retaining PII.
export async function DELETE(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limited = enforceRateLimit({ name: 'account-delete', limit: 3, identifier: user.id, request })
  if (limited) return limited

  const body = (await request.json().catch(() => ({}))) as { confirm?: string }
  if (body.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'confirmation required' }, { status: 400 })
  }

  // Audit first — userId is SetNull on delete, so the record survives with
  // the anonymized actor email retained as legal-basis evidence of the
  // erasure request.
  await logSecurityEvent({
    action: 'account.deleted.self',
    userId: user.id,
    actorEmail: user.email,
    request,
    meta: { clerkId: user.clerkId },
  })

  // Delete Clerk identity first; if it fails, we still remove our data below.
  try {
    const client = await clerkClient()
    await client.users.deleteUser(user.clerkId)
  } catch (err) {
    console.error('[me/account] clerk delete failed', err)
  }

  await prisma.user.delete({ where: { id: user.id } })

  return NextResponse.json({ ok: true, deleted: true })
}
