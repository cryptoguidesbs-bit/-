import 'server-only'

import type { NotificationType } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// Server-side helper for creating user notifications (used by system events
// — brief publishes, billing changes, etc.).
export async function createNotification(
  userId: string,
  data: { type?: NotificationType; title: string; body?: string; href?: string },
) {
  return prisma.notification.create({
    data: {
      userId,
      type: data.type ?? 'SYSTEM',
      title: data.title.slice(0, 200),
      body: data.body?.slice(0, 1000),
      href: data.href,
    },
  })
}
