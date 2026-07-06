// ---------------------------------------------------------------------------
// Referral program policy (stage 17).
//
// Monetary rewards (commission) are region-gated via the
// 'referral.rewards' feature policy in src/config/features.ts — several
// jurisdictions regulate paid referral/finder arrangements, so accrual only
// happens for referrers whose stored country passes the whitelist
// (see docs/legal-review.md; final country list lands with stage 22).
// ---------------------------------------------------------------------------

export const REFERRAL = {
  /** Commission on the referred user's first paid subscription (monthly base). */
  commissionRate: 0.1,
  /** Attribution cookie. */
  cookieName: 'cg_ref',
  cookieMaxAgeDays: 30,
  /** A referred account older than this cannot be attributed (anti-claiming). */
  attributionWindowDays: 7,
  /** Max attribution attempts credited to one referrer per rolling 24h. */
  dailyReferralCap: 10,
  /** Leaderboard size. */
  leaderboardSize: 10,
  /** Referral code alphabet/length (no confusable characters). */
  codeAlphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  codeLength: 8,
} as const
