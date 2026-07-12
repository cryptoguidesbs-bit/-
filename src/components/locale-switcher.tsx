'use client'

import { useLocale } from 'next-intl'

import { usePathname, useRouter } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { Button } from '@/components/ui/button'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchTo = (next: Locale) => {
    // Persist the explicit choice so it outranks browser-language/geo
    // detection on future visits (middleware honors NEXT_LOCALE).
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
    router.replace(pathname, { locale: next })
  }

  return (
    <div className="flex items-center gap-1" data-testid="locale-switcher">
      {routing.locales.map((l) => (
        <Button
          key={l}
          variant={l === locale ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={l === locale}
          data-testid={`locale-switch-${l}`}
          onClick={() => switchTo(l)}
        >
          {l === 'ko' ? '한국어' : 'EN'}
        </Button>
      ))}
    </div>
  )
}
