import 'server-only'

import { timingSafeEqual } from 'node:crypto'

import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/prisma'

// Pipeline triggers (ingest/summarize) are internal operations: allow either
// the cron secret header (for schedulers) or a signed-in ADMIN user.
export async function canTriggerPipeline(request: NextRequest): Promise<boolean> {
  if (hasValidCronSecret(request)) return true

  const { userId: clerkId } = await auth()
  if (!clerkId) return false
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { role: true } })
  return user?.role === 'ADMIN'
}

/** Constant-time comparison of the x-cron-secret header with CRON_SECRET. */
export function hasValidCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret')
  if (!secret || !provided) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}
