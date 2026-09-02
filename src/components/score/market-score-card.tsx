'use client'

import { ArrowRight, Gauge } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useMarketScore } from '@/hooks/use-market-data'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { bandColorClass } from '@/components/score/market-score-gauge'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

// Compact Market Score for the home dashboard — number, band and a meter,
// linking to the full breakdown on /score.
export function MarketScoreCard() {
  const t = useTranslations('score')
  const { data, isLoading } = useMarketScore()

  return (
    <Card data-testid="market-score-card">
      <CardContent className="flex items-center justify-between gap-6 p-5">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 font-semibold">
            <Gauge className="h-4 w-4 text-primary" />
            {t('title')}
          </p>
          <p className="text-xs text-muted-foreground">{t('cardSubtitle')}</p>
          <Link href="/score" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {t('cardLink')}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading && !data && <Skeleton className="h-14 w-32" />}

        {data && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={cn('text-4xl font-bold tabular-nums', bandColorClass(data.band))}>
                {data.score ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.band ? t(`bands.${data.band}`) : t('bands.unavailable')}
                {data.partial && data.score !== null ? ` · ${t('partialShort')}` : ''}
              </p>
            </div>
            <div className="h-16 w-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="w-full rounded-full bg-gradient-to-t from-sky-400 via-yellow-400 to-red-500"
                style={{ height: `${data.score ?? 0}%`, marginTop: `${100 - (data.score ?? 0)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
