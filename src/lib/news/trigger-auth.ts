import 'server-only'

import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/prisma'

// Pipeline triggers (ingest/summarize) are internal operations: allow either
// the cron secret header (for schedulers) or a signed-in ADMIN user.
export async function canTriggerPipeline(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('x-cron-secret') === secret) return true

  const { userId: clerkId } = await auth()
  if (!clerkId) return false
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { role: true } })
  return user?.role === 'ADMIN'
}
