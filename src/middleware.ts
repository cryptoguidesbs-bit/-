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
  // Crypto Map — login required, all plans free (no plan gate).
  '/:locale/map(.*)',
  '/map(.*)',
])

// First-visit locale detection (no cookie, no locale in the URL):
//   1. Browser language (Accept-Language, highest-quality tag):
//      Korean → ko, EVERY other language → en. Deliberately not next-intl's
//      default negotiation, which would drop unmatched languages (fr, ja, …)
//      onto defaultLocale (ko).
//   2. Geo country only as a fallback when the browser sends no
//      Accept-Language at all (KR → ko, other known countries → en).
//   3. Neither signal → next-intl defaultLocale.
// A returning visitor's explicit choice (NEXT_LOCALE cookie, set by the
// locale switcher) always wins over detection.
const LOCALE_BY_COUNTRY: Record<string, Locale> = {
  KR: 'ko',
}

function countryLocale(request: NextRequest): Locale | undefined {
  const country = (
    request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry')
  )?.toUpperCase()
  if (!country) return undefined
  return LOCALE_BY_COUNTRY[country] ?? 'en'
}

function acceptLanguageLocale(request: NextRequest): Locale | undefined {
  const header = request.headers.get('accept-language')
  if (!header) return undefined

  // Highest-quality language tag decides ("browser language").
  const primary = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const q = qParam ? Number(qParam.slice(2)) : 1
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 }
    })
    .filter((entry) => entry.tag && entry.tag !== '*')
    .sort((a, b) => b.q - a.q)[0]

  if (!primary) return undefined
  return primary.tag.startsWith('ko') ? 'ko' : 'en'
}

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

  // First visit (no cookie, no locale in the URL): browser language decides —
  // Korean → /ko, every other language → /en; geo country only when the
  // browser sends no Accept-Language. A returning visitor's explicit choice
  // (cookie) always wins and skips detection entirely.
  if (!hasLocalePrefix && !hasLocaleCookie) {
    const locale = acceptLanguageLocale(request) ?? countryLocale(request)
    if (locale) {
      const headers = new Headers(request.headers)
      headers.set('accept-language', locale)
      return intlMiddleware(new NextRequest(request, { headers }))
    }
  }

  return intlMiddleware(request)
})

export const config = {
  // Run on everything except Next internals and static files, plus all API
  // routes (Clerk needs to see them to authenticate route handlers) and
  // Clerk's auto-proxy path.
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/(api|trpc)(.*)', '/__clerk/:path*'],
}
