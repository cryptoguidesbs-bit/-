'use client'

import { useLocale } from 'next-intl'

import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { Button } from '@/components/ui/button'

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1">
      {routing.locales.map((l) => (
        <Button
          key={l}
          variant={l === locale ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => router.replace(pathname, { locale: l })}
        >
          {l === 'ko' ? '한국어' : 'EN'}
        </Button>
      ))}
    </div>
  )
}
