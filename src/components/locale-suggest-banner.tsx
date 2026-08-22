'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { usePathname, useRouter } from '@/i18n/navigation'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year
const DISMISS_KEY = 'cg-locale-suggest-dismissed'

// Chrome/Edge add a "translated-ltr" / "translated-rtl" class to <html>
// while their built-in translator is rewriting the page.
function pageIsMachineTranslated(): boolean {
  return Array.from(document.documentElement.classList).some((c) => c.startsWith('translated-'))
}

// The site is English by default (global-first). Korean-language browsers
// on an English page get a one-line, dismissible "view in Korean" offer —
// our Korean copy beats the browser's machine translation ("Lightning" →
// "번개", "USDC" → "미국"). Two triggers:
//   1. first visit (no NEXT_LOCALE cookie) from a Korean-language browser
//   2. the browser is machine-translating THIS page (detected via the
//      translated-* class), even if the visitor once picked English
// Client-only after mount, so SSR output is stable.
export function LocaleSuggestBanner() {
  const locale = useLocale()
  const t = useTranslations('common.koSuggest')
  const router = useRouter()
  const pathname = usePathname()
  const [mode, setMode] = useState<'hidden' | 'first-visit' | 'translated'>('hidden')

  useEffect(() => {
    if (locale !== 'en') return
    const browserKo = (navigator.language || '').toLowerCase().startsWith('ko')
    if (!browserKo) return
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
    if (dismissed) return
    const hasChoice = /(?:^|;\s*)NEXT_LOCALE=/.test(document.cookie)

    const evaluate = () => {
      if (pageIsMachineTranslated()) setMode('translated')
      else if (!hasChoice) setMode('first-visit')
      else setMode('hidden')
    }
    evaluate()
    // The translator kicks in after load — watch the <html> class list.
    const observer = new MutationObserver(evaluate)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [locale])

  if (mode === 'hidden') return null

  const switchToKorean = () => {
    document.cookie = `NEXT_LOCALE=ko; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
    router.replace(pathname, { locale: 'ko' })
  }
  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1')
    setMode('hidden')
  }

  return (
    <div
      role="region"
      aria-label={t('cta')}
      data-testid="locale-suggest-banner"
      data-mode={mode}
      className="border-b bg-primary/10 text-sm"
      // Our own Korean sentence — keep the translator's hands off it.
      translate="no"
    >
      <div className="container flex items-center gap-3 py-2">
        <p className="min-w-0 flex-1 truncate">
          {mode === 'translated' ? t('translatedText') : t('text')}
        </p>
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
