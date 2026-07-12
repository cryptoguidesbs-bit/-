import { NextRequest, NextResponse } from 'next/server'

import { getDbUser } from '@/lib/user'

export const dynamic = 'force-dynamic'

// Approximate fallback location when browser geolocation is denied:
// the platform geo header resolves to a country-center; with no header
// (local dev) we fall back to a locale-default city. Nothing is stored.
const COUNTRY_CENTERS: Record<string, { lat: number; lng: number }> = {
  KR: { lat: 37.5665, lng: 126.978 }, // Seoul
  US: { lat: 40.7128, lng: -74.006 }, // New York
  JP: { lat: 35.6812, lng: 139.7671 }, // Tokyo
  SG: { lat: 1.3521, lng: 103.8198 },
  GB: { lat: 51.5074, lng: -0.1278 }, // London
  DE: { lat: 52.52, lng: 13.405 }, // Berlin
  FR: { lat: 48.8566, lng: 2.3522 }, // Paris
  NL: { lat: 52.3676, lng: 4.9041 }, // Amsterdam
  CA: { lat: 43.6532, lng: -79.3832 }, // Toronto
  AU: { lat: -33.8688, lng: 151.2093 }, // Sydney
  HK: { lat: 22.3193, lng: 114.1694 },
  TW: { lat: 25.033, lng: 121.5654 }, // Taipei
}

const LOCALE_DEFAULT: Record<string, { lat: number; lng: number }> = {
  ko: COUNTRY_CENTERS.KR,
  en: COUNTRY_CENTERS.US,
}

// GET /api/map/locate?locale=ko — country-level approximate position.
export async function GET(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const country =
    request.headers.get('x-vercel-ip-country')?.toUpperCase() ??
    request.headers.get('cf-ipcountry')?.toUpperCase() ??
    null

  if (country && COUNTRY_CENTERS[country]) {
    return NextResponse.json({ source: 'country', country, ...COUNTRY_CENTERS[country] })
  }

  const locale = request.nextUrl.searchParams.get('locale') ?? 'ko'
  const fallback = LOCALE_DEFAULT[locale] ?? LOCALE_DEFAULT.ko
  return NextResponse.json({ source: 'default', country: null, ...fallback })
}
