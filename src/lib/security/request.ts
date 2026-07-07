import type { NextRequest } from 'next/server'

// Client IP from the hosting platform's forwarding headers. Behind
// Vercel/Cloudflare these are set by the platform; locally they are absent.
export function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  )
}

// Same-origin check for CSRF defense on cookie-authenticated mutations.
// A browser always sends Origin on cross-site AND same-site state-changing
// requests, so a missing/mismatched Origin on a mutation is rejected.
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  // Prefer the forwarded host set by the platform; fall back to Host.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  return !!host && originHost === host
}
