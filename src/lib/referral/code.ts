import 'server-only'

import crypto from 'node:crypto'

import { REFERRAL } from '@/config/referral'
import { prisma } from '@/lib/prisma'

function randomCode(): string {
  const { codeAlphabet, codeLength } = REFERRAL
  const bytes = crypto.randomBytes(codeLength)
  let out = ''
  for (let i = 0; i < codeLength; i++) out += codeAlphabet[bytes[i] % codeAlphabet.length]
  return out
}

/** The user's referral code, created on first access (collision-retried). */
export async function getOrCreateReferralCode(userId: string) {
  const existing = await prisma.referralCode.findUnique({ where: { userId } })
  if (existing) return existing

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.referralCode.create({ data: { userId, code: randomCode() } })
    } catch {
      // unique collision (code or a concurrent create for this user) — retry/refetch
      const raced = await prisma.referralCode.findUnique({ where: { userId } })
      if (raced) return raced
    }
  }
  throw new Error('could not allocate referral code')
}
