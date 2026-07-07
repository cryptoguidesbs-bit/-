import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Client source maps add weight and expose source; keep them off in prod.
  productionBrowserSourceMaps: false,
  experimental: {
    // Required in Next.js 14 for instrumentation.ts (Sentry server init).
    instrumentationHook: true,
    // Per-icon/per-util imports instead of pulling whole barrels into the
    // client bundle — the biggest shared-chunk win for a lucide-heavy UI.
    optimizePackageImports: ['lucide-react', '@tanstack/react-query', 'date-fns'],
  },
  images: {
    // Serve modern formats when the browser supports them.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  compiler: {
    // Strip console.* (except error/warn) from production bundles.
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Source map upload only runs when SENTRY_AUTH_TOKEN is provided.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  telemetry: false,
  widenClientFileUpload: true,
  disableLogger: true,
}

export default withSentryConfig(withNextIntl(nextConfig), sentryOptions)
