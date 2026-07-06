import 'server-only'

import crypto from 'node:crypto'

import { REFERRAL } from '@/config/referral'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Referral attribution with anti-abuse checks. Called when a signed-in user
// completes consent (signup) while carrying the referral cookie.
//
// Abuse rules (rejections are stored as REJECTED rows for auditing):
//   self-referral  — own code
//   account-age    — account older than the attribution window
//   self-ip        — signup IP matches the referrer's own recorded IP
//   duplicate-ip   — signup IP already used by another referral of the
//                    same referrer
//   velocity       — referrer exceeded the rolling-24h attribution cap
// ---------------------------------------------------------------------------

export type AttributionResult =
  | { outcome: 'attributed'; referralId: string }
  | { outcome: 'rejected'; reason: string }
  | { outcome: 'skipped'; reason: string }

export function hashIp(ip: string | null): string | null {
  if (!ip) return null
  const salt = process.env.REFERRAL_IP_SALT ?? process.env.CRON_SECRET ?? 'dev-salt'
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export async function attributeReferral(input: {
  referredUserId: string
  code: string
  ip: string | null
}): Promise<AttributionResult> {
  const code = input.code.trim().toUpperCase()
  if (!code) return { outcome: 'skipped', reason: 'no code' }

  const referralCode = await prisma.referralCode.findUnique({
    where: { code },
    include: { user: { select: { id: true } } },
  })
  if (!referralCode) return { outcome: 'skipped', reason: 'unknown code' }

  const existing = await prisma.referral.findUnique({
    where: { referredUserId: input.referredUserId },
  })
  if (existing) return { outcome: 'skipped', reason: 'already attributed' }

  const referred = await prisma.user.findUnique({ where: { id: input.referredUserId } })
  if (!referred) return { outcome: 'skipped', reason: 'unknown user' }

  const referrerId = referralCode.userId
  const ipHash = hashIp(input.ip)

  const reject = async (reason: string): Promise<AttributionResult> => {
    await prisma.referral.create({
      data: {
        referrerId,
        referredUserId: referred.id,
        code,
        status: 'REJECTED',
        ipHash,
        reason,
      },
    })
    return { outcome: 'rejected', reason }
  }

  // 1. Self-referral.
  if (referrerId === referred.id) return reject('self-referral')

  // 2. Only genuinely new accounts can be attributed.
  const windowMs = REFERRAL.attributionWindowDays * 86_400_000
  if (Date.now() - referred.createdAt.getTime() > windowMs) return reject('account-age')

  if (ipHash) {
    // 3. Signup IP matches the referrer's own recorded IP → alt-account farm.
    const referrerConsent = await prisma.consentLog.findFirst({
      where: { userId: referrerId, ipAddress: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { ipAddress: true },
    })
    if (referrerConsent && hashIp(referrerConsent.ipAddress) === ipHash) {
      return reject('self-ip')
    }

    // 4. Same IP already credited to this referrer.
    const dup = await prisma.referral.findFirst({
      where: { referrerId, ipHash },
    })
    if (dup) return reject('duplicate-ip')
  }

  // 5. Velocity cap (all attempts count — rejected ones too).
  const since = new Date(Date.now() - 86_400_000)
  const recent = await prisma.referral.count({
    where: { referrerId, createdAt: { gte: since } },
  })
  if (recent >= REFERRAL.dailyReferralCap) return reject('velocity')

  const referral = await prisma.referral.create({
    data: {
      referrerId,
      referredUserId: referred.id,
      code,
      status: 'PENDING',
      ipHash,
    },
  })
  return { outcome: 'attributed', referralId: referral.id }
}
