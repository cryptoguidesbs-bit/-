import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Captures errors from React Server Components and request handlers —
// without this hook most server-side errors never reach Sentry on v9+.
export const onRequestError = Sentry.captureRequestError
