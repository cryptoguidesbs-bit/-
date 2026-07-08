import 'server-only'

import type { CountryRegulation } from '@prisma/client'

import { REGULATION_SEED } from '@/config/crypto-regulation'
import { prisma } from '@/lib/prisma'

// Seed CountryRegulation from config if the table is empty (idempotent).
// The config is the authoring source; the DB copy is what the API serves and
// what admin edits later.
export async function seedRegulationsIfEmpty(): Promise<void> {
  const count = await prisma.countryRegulation.count()
  if (count > 0) return
  await prisma.countryRegulation.createMany({
    data: REGULATION_SEED.map((r) => ({
      countryCode: r.countryCode,
      status: r.status,
      summaryKo: r.summaryKo,
      summaryEn: r.summaryEn,
    })),
    skipDuplicates: true,
  })
}

export async function getRegulations(): Promise<CountryRegulation[]> {
  await seedRegulationsIfEmpty()
  return prisma.countryRegulation.findMany({ orderBy: { countryCode: 'asc' } })
}
