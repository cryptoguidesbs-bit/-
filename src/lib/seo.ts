import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

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

const OG_LOCALES: Record<string, string> = { ko: 'ko_KR', en: 'en_US' }

// Full per-page metadata: title/description plus page-specific OpenGraph and
// Twitter objects. Next.js does NOT deep-merge nested metadata objects, so a
// page that sets only `title` inherits the root layout's og:title (the home
// tagline) — every shared link then previews as the home card. This helper
// keeps og:title/og:url in sync with the page. og:image still comes from the
// [locale]/opengraph-image.tsx file convention.
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
  const canonical = getPathname({ href: path, locale: locale as (typeof routing.locales)[number] })
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: localeAlternates(path),
    },
    openGraph: {
      type: 'website' as const,
      siteName: 'CryptoGuide',
      locale: OG_LOCALES[locale] ?? locale,
      url: canonical,
      title,
      description,
      // A page-level openGraph object suppresses the [locale]/opengraph-image
      // file-convention cascade on child routes — re-point it explicitly.
      images: [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
    },
  }
}
