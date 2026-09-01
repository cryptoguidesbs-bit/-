import * as Sentry from '@sentry/nextjs'

// Client-side Sentry init. This file replaces sentry.client.config.ts —
// Turbopack (the Next 16 default bundler) only injects instrumentation-client,
// not the legacy sentry.client.config file.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

// Sentry is a no-op locally until a DSN is configured in .env.local.
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  })
}

// App Router navigation instrumentation (required by the v10 SDK template).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
