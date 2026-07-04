import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'

import { routing, type Locale } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

// Routes that require a signed-in user.
const isProtectedRoute = createRouteMatcher(['/:locale/profile(.*)', '/profile(.*)'])

// Region-based locale mapping: visitors from these countries default to
// Korean; everyone else defaults to English. The country comes from the
// hosting platform's geo header (Vercel / Cloudflare); locally there is no
// header, so detection falls back to Accept-Language.
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

function pathnameLocale(pathname: string): Locale | undefined {
  return routing.locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl

  // API routes only need Clerk's auth context, not locale routing.
  if (pathname.startsWith('/api')) {
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
  const hasLocaleCookie = request.cookies.has('NEXT_LOCALE')

  // First visit (no cookie, no locale in the URL): let the visitor's country
  // decide the locale ahead of the browser's Accept-Language. A returning
  // visitor's explicit choice (cookie) always wins.
  if (!hasLocalePrefix && !hasLocaleCookie) {
    const locale = countryLocale(request)
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
