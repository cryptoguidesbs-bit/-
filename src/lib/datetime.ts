/**
 * Timezone policy
 * ---------------
 * - Persistence (DB, API payloads): always UTC. Prisma DateTime is UTC,
 *   API responses use ISO 8601 strings with a `Z` suffix.
 * - Display: convert to the user's timezone in client components only,
 *   so server-rendered markup stays deterministic.
 */

/** Current time as a UTC ISO 8601 string — use this when persisting. */
export function nowUtcIso(): string {
  return new Date().toISOString()
}

/** IANA timezone of the current browser (e.g. "Asia/Seoul"). Client-side only. */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Format a UTC date in the given (or browser) timezone and locale. */
export function formatLocal(
  date: Date | string,
  locale: string,
  options?: Intl.DateTimeFormatOptions & { timeZone?: string }
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    ...options,
  }).format(d)
}

/** Format a date pinned to UTC — for logs, audit trails and debugging. */
export function formatUtc(date: Date | string, locale = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(d)
}
