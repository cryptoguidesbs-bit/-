import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

// Shared SEO constants — the root layout and per-page metadata must agree.
export const SITE_NAME = 'CryptoGuide'

const OG_LOCALES: Record<string, string> = { ko: 'ko_KR', en: 'en_US' }
export function ogLocale(locale: string): string {
  return OG_LOCALES[locale] ?? locale
}

// hreflang map for a route, including x-default (→ default locale).
export function localeAlternates(href: string): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const locale of routing.locales) {
    languages[locale] = getPathname({ href, locale })
  }
  languages['x-default'] = getPathname({ href, locale: routing.defaultLocale })
  return languages
}

// Per-page `alternates` metadata: canonical for the current locale + hreflang.
export function pageAlternates(href: string, locale: string) {
  return {
    canonical: getPathname({ href, locale: locale as (typeof routing.locales)[number] }),
    languages: localeAlternates(href),
  }
}

// Full per-page metadata: title/description plus a page-specific OpenGraph
// object. Next.js does NOT deep-merge nested metadata objects, so a page that
// sets only `title` inherits the root layout's og:title (the home tagline) —
// every shared link then previews as the home card. Twitter tags are derived
// by Next from openGraph (title/description/images, summary_large_image).
export function pageMeta({
  locale,
  path,
  title,
  description,
}: {
  locale: string
  path: string
  title: string
  description?: string
}) {
  const alternates = pageAlternates(path, locale)
  return {
    title,
    description,
    alternates,
    openGraph: {
      type: 'website' as const,
      siteName: SITE_NAME,
      locale: ogLocale(locale),
      url: alternates.canonical,
      title,
      description,
      // A page-level openGraph object suppresses the [locale]/opengraph-image
      // file-convention cascade on child routes — re-point it explicitly.
      images: [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: title }],
    },
  }
}
