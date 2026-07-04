'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { formatLocal, formatUtc, getUserTimezone } from '@/lib/datetime'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Demonstrates the timezone policy: the same instant rendered once in UTC
 * (as stored) and once in the user's local timezone (as displayed).
 * Rendered client-side only to avoid hydration mismatches.
 */
export function LocalTime() {
  const locale = useLocale()
  const t = useTranslations('home')
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-5 w-64" />
      </div>
    )
  }

  return (
    <dl className="space-y-1 font-mono text-sm">
      <div className="flex gap-2">
        <dt className="text-muted-foreground">{t('serverTimeUtc')}:</dt>
        <dd>{formatUtc(now, locale)}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-muted-foreground">
          {t('localTime')} ({getUserTimezone()}):
        </dt>
        <dd>{formatLocal(now, locale)}</dd>
      </div>
    </dl>
  )
}
