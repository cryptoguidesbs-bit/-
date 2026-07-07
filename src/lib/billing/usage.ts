import 'server-only'

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Lightweight "service was used" signal for the annual-refund window. One row
// per user/kind/hour (deduped) — enough to prove usage without building an
// analytics pipeline. Never throws into the caller.
// ---------------------------------------------------------------------------

function hourBucket(d = new Date()): string {
  return d.toISOString().slice(0, 13) // YYYY-MM-DDTHH
}

export async function recordAccess(userId: string, kind: string): Promise<void> {
  try {
    await prisma.accessLog.upsert({
      where: { userId_kind_hourBucket: { userId, kind, hourBucket: hourBucket() } },
      update: {},
      create: { userId, kind, hourBucket: hourBucket() },
    })
  } catch {
    /* best-effort */
  }
}

/** Whether the user has any recorded access at/after the given time. */
export async function hasUsedSince(userId: string, since: Date): Promise<boolean> {
  const count = await prisma.accessLog.count({
    where: { userId, createdAt: { gte: since } },
  })
  return count > 0
}
