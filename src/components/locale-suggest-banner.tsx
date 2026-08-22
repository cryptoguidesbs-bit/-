'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { usePathname, useRouter } from '@/i18n/navigation'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year
const DISMISS_KEY = 'cg-locale-suggest-dismissed'

// The site is English by default (global-first). Korean-language browsers
// landing on an English page get a one-line, dismissible "view in Korean"
// offer — a human-written Korean version beats the browser's machine
// translation of the English page. Shown only when there is no explicit
// locale choice yet (NEXT_LOCALE cookie) and it hasn't been dismissed.
// Client-only after mount, so SSR output is stable.
export function LocaleSuggestBanner() {
  const locale = useLocale()
  const t = useTranslations('common.koSuggest')
  const router = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (locale !== 'en') return
    const browserKo = (navigator.language || '').toLowerCase().startsWith('ko')
    const hasChoice = /(?:^|;\s*)NEXT_LOCALE=/.test(document.cookie)
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
    setVisible(browserKo && !hasChoice && !dismissed)
  }, [locale])

  if (!visible) return null

  const switchToKorean = () => {
    document.cookie = `NEXT_LOCALE=ko; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
    router.replace(pathname, { locale: 'ko' })
  }
  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label={t('text')}
      data-testid="locale-suggest-banner"
      className="border-b bg-primary/10 text-sm"
    >
      <div className="container flex items-center gap-3 py-2">
        <p className="min-w-0 flex-1 truncate">{t('text')}</p>
        <button
          type="button"
          onClick={switchToKorean}
          className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('cta')}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
