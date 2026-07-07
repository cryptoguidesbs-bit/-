// Admin ops-monitor thresholds (stage 19).
export const ADMIN_OPS = {
  /** PAST_DUE/INCOMPLETE subscriptions at or above this count raise an anomaly. */
  paymentFailureThreshold: 5,
  /** Newest news item older than this → pipeline-stale anomaly. */
  newsStaleHours: 24,
  /** Newest published brief older than this → pipeline-stale anomaly. */
  briefStaleHours: 48,
  /** PAST_DUE subscriptions past period end by this many days auto-expire. */
  expireGraceDays: 7,
} as const
