import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const isProd = process.env.NODE_ENV === 'production'

// Clerk Frontend API host is encoded in the publishable key
// (pk_live_<base64("clerk.example.com$")>).
function clerkFrontendApiHost() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const encoded = key.split('_')[2]
  if (!encoded) return null
  try {
    return Buffer.from(encoded, 'base64').toString('utf8').replace(/\$/, '')
  } catch {
    return null
  }
}
function sentryIngestOrigin() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return null
  try {
    return new URL(dsn).origin
  } catch {
    return null
  }
}

// Content-Security-Policy. Production gets the full allowlist (verified
// against Clerk, Leaflet/OSM tiles, Binance stream, Vercel Analytics,
// Sentry); development keeps the conservative frame/base/form policy only,
// because Next dev + HMR need eval and the toolchain changes often.
function buildCsp() {
  const base = "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'"
  if (!isProd) return base
  const clerk = clerkFrontendApiHost()
  const clerkOrigin = clerk ? `https://${clerk}` : ''
  const sentry = sentryIngestOrigin() ?? ''
  const vercelLive = process.env.VERCEL_ENV === 'preview' ? 'https://vercel.live' : ''
  const directives = [
    "default-src 'self'",
    // Next inline bootstrap needs 'unsafe-inline'; no eval in production.
    `script-src 'self' 'unsafe-inline' ${clerkOrigin} https://challenges.cloudflare.com ${vercelLive}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://img.clerk.com https://*.tile.openstreetmap.org ${clerkOrigin}`,
    "font-src 'self' data:",
    `connect-src 'self' ${clerkOrigin} https://*.protect.clerk.com wss://stream.binance.com:9443 ${sentry} ${vercelLive}`,
    `frame-src 'self' https://challenges.cloudflare.com https://*.protect.clerk.com ${clerkOrigin} ${vercelLive}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
    base,
  ]
  return directives.map((d) => d.replace(/\s+/g, ' ').trim()).join('; ')
}

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
  // Drop access to powerful features the app never uses. Geolocation is
  // allowed for our own document only (Crypto Map "locate me"); camera/mic
  // and FLoC stay off everywhere, and no third-party frame gets any of them.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  },
  // CSP — full allowlist in production, frame/base/form-only in dev
  // (see buildCsp above and docs/security-checklist.md).
  { key: 'Content-Security-Policy', value: buildCsp() },
]

// Authenticated / keyed JSON must never be cached by shared caches or the
// browser back/forward cache.
const privateNoStore = [{ key: 'Cache-Control', value: 'private, no-store' }]

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
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/me/:path*', headers: privateNoStore },
      { source: '/api/admin/:path*', headers: privateNoStore },
      { source: '/api/v1/:path*', headers: privateNoStore },
    ]
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
