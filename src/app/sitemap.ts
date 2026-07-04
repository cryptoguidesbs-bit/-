import type { MetadataRoute } from 'next'

import { legalSlugs } from '@/config/legal'
import { navItems } from '@/config/nav'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { siteUrl } from '@/lib/site'

const routes = [...navItems.map((item) => item.href), ...legalSlugs.map((s) => `/legal/${s}`)]

function absoluteUrl(href: string, locale: Locale) {
  return siteUrl + getPathname({ href, locale })
}

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((href) => ({
    url: absoluteUrl(href, routing.defaultLocale),
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: href === '/' ? 1 : 0.7,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, absoluteUrl(href, locale)]),
      ),
    },
  }))
}
