// Quick inspection: latest users + consent logs (dev helper).
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const users = await prisma.user.findMany({
  include: { consentLogs: true },
  orderBy: { createdAt: 'desc' },
  take: 5,
})

for (const u of users) {
  console.log(`User ${u.email} (clerkId=${u.clerkId})`)
  for (const c of u.consentLogs) {
    console.log(
      `  ConsentLog: type=${c.type} version=${c.version} granted=${c.granted} ip=${c.ipAddress} ua=${(c.userAgent ?? '').slice(0, 40)} at=${c.createdAt.toISOString()}`,
    )
  }
}

await prisma.$disconnect()
