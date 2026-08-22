import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'

import { routing, type Locale } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

// Routes that require a signed-in user.
const isProtectedRoute = createRouteMatcher([
  '/:locale/profile(.*)',
  '/profile(.*)',
  '/:locale/billing(.*)',
  '/billing(.*)',
  '/:locale/dashboard(.*)',
  '/dashboard(.*)',
  // Crypto Map is PUBLIC (it is the home page's main view) — read-only map
  // APIs are IP rate-limited instead of login-gated.
])

// First-visit language policy (no cookie, no locale in the URL): ALWAYS
// English. The site is global-first; Korean is one click away via the locale
// switcher, and that explicit choice (NEXT_LOCALE cookie) is remembered and
// always wins. Browser language / geo are deliberately NOT used — next-intl's
// Accept-Language negotiation is bypassed by forcing the header to 'en'.
const FIRST_VISIT_LOCALE: Locale = 'en'

function pathnameLocale(pathname: string): Locale | undefined {
  return routing.locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
}

// Cookie-authenticated, browser-initiated mutation routes that must be
// CSRF-protected by a same-origin check. Excludes signature-verified
// webhooks (/api/billing/webhook, /api/webhooks/*), API-key routes
// (/api/v1/*) and cron-secret routes (they carry no browser Origin).
const CSRF_MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
function isCsrfProtected(pathname: string): boolean {
  if (pathname === '/api/billing/webhook' || pathname.startsWith('/api/webhooks/')) return false
  return (
    pathname.startsWith('/api/me/') ||
    pathname.startsWith('/api/admin/') ||
    pathname === '/api/consent' ||
    pathname === '/api/billing/checkout' ||
    pathname === '/api/billing/cancel' ||
    pathname === '/api/billing/change' ||
    pathname === '/api/billing/refund'
  )
}

function sameOriginOk(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  return !!host && originHost === host
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl

  // API routes only need Clerk's auth context, not locale routing.
  // /r/* are referral landing redirects (no locale prefix by design).
  if (pathname.startsWith('/api') || pathname.startsWith('/r/')) {
    // CSRF defense-in-depth: reject cross-origin mutations on the
    // cookie-authenticated routes before they reach the handler. Bearer-token
    // requests are exempt — CSRF targets ambient credentials (cookies), and
    // browsers never auto-attach an Authorization header cross-site.
    if (CSRF_MUTATING_METHODS.has(request.method) && isCsrfProtected(pathname)) {
      const hasBearer = request.headers
        .get('authorization')
        ?.toLowerCase()
        .startsWith('bearer ')
      // Cron/server-to-server calls (x-cron-secret) are not browser CSRF
      // vectors and carry no Origin — exempt them alongside bearer tokens.
      const hasCronSecret = request.headers.has('x-cron-secret')
      if (!hasBearer && !hasCronSecret && !sameOriginOk(request)) {
        return NextResponse.json({ error: 'cross-origin request blocked' }, { status: 403 })
      }
    }
    return NextResponse.next()
  }

  if (isProtectedRoute(request)) {
    const { userId } = await auth()
    if (!userId) {
      const locale = pathnameLocale(pathname) ?? routing.defaultLocale
      const signInUrl = new URL(`/${locale}/sign-in`, request.url)
      signInUrl.searchParams.set('redirect_url', request.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  const hasLocalePrefix = pathnameLocale(pathname) !== undefined
  // Only a VALID cookie counts as an explicit choice — a stray/garbage value
  // must not disable detection.
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  const hasLocaleCookie = routing.locales.includes(cookieLocale as Locale)

  // First visit (no cookie, no locale in the URL) → English, regardless of
  // browser language or country. A returning visitor's explicit choice
  // (cookie) always wins.
  if (!hasLocalePrefix && !hasLocaleCookie) {
    const headers = new Headers(request.headers)
    headers.set('accept-language', FIRST_VISIT_LOCALE)
    return intlMiddleware(new NextRequest(request, { headers }))
  }

  return intlMiddleware(request)
})

export const config = {
  // Run on everything except Next internals and static files, plus all API
  // routes (Clerk needs to see them to authenticate route handlers) and
  // Clerk's auto-proxy path.
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/(api|trpc)(.*)', '/__clerk/:path*'],
}
