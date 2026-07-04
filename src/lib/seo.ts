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
