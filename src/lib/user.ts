import 'server-only'

import { auth, clerkClient } from '@clerk/nextjs/server'
import type { User } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// Resolve the signed-in requester to our DB user (self-healing if the row
// doesn't exist yet, e.g. consent sync raced).
export async function getDbUser(): Promise<User | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const existing = await prisma.user.findUnique({ where: { clerkId } })
  if (existing) return existing

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(clerkId)
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress
  if (!email) return null

  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email,
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
      image: clerkUser.imageUrl,
    },
  })
}
