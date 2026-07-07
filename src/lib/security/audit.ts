import 'server-only'

import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { clientIp } from './request'

// Append-only security audit trail. Never throws into the caller — a logging
// failure must not break the action being audited.
export async function logSecurityEvent(input: {
  action: string
  userId?: string | null
  actorEmail?: string | null
  request?: NextRequest
  meta?: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        action: input.action,
        userId: input.userId ?? null,
        actorEmail: input.actorEmail ?? null,
        ip: input.request ? clientIp(input.request) : null,
        userAgent: input.request?.headers.get('user-agent') ?? null,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch {
    /* audit logging is best-effort */
  }
}
