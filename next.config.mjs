import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // HSTS — force HTTPS for 2 years incl. subdomains (effective once served
  // over TLS; ignored on plain HTTP so it is safe in local dev).
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Drop access to powerful features the app never uses.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Conservative CSP: clickjacking (frame-ancestors), base-tag injection
  // (base-uri) and form-hijack (form-action) protection without restricting
  // script sources — a full script-src policy is a documented deploy-time
  // hardening step (needs browser verification against Clerk/Next inline
  // bootstrap; see docs/security-checklist.md).
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
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
