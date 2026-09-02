import type { MetadataRoute } from 'next'

import { legalSlugs } from '@/config/legal'
import { navItems } from '@/config/nav'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { siteUrl } from '@/lib/site'

// Every public nav destination (the Crypto Map is public now), the legal
// documents and the Data & methodology page.
const routes = [
  ...navItems.map((item) => item.href),
  ...legalSlugs.map((s) => `/legal/${s}`),
  '/data',
  '/enterprise',
]

function absoluteUrl(href: string, locale: Locale) {
  return siteUrl + getPathname({ href, locale })
}

export default function sitemap(): MetadataRoute.Sitemap {
  // One entry per route AND locale (both listed as <loc>), each carrying the
  // full hreflang alternate set — the most robust shape for Google.
  return routing.locales.flatMap((locale) =>
    routes.map((href) => ({
      url: absoluteUrl(href, locale),
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: href === '/' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, absoluteUrl(href, l)]),
        ),
      },
    })),
  )
}
