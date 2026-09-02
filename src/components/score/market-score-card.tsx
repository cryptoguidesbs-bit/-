'use client'

import { ArrowRight, Gauge, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useMarketScore } from '@/hooks/use-market-data'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataStatus } from '@/components/data-status'
import { GaugeCard } from '@/components/home/gauge-card'
import { bandColorClass } from '@/components/score/market-score-gauge'
import { Link } from '@/i18n/navigation'

// Compact Market Score for the home dashboard — number, band and a meter,
// linking to the full breakdown on /score. Low = cold, high = overheated.
export const SCORE_METER_GRADIENT = 'bg-gradient-to-t from-sky-400 via-yellow-400 to-red-500'

export function MarketScoreCard() {
  const t = useTranslations('score')
  const { data, isLoading, refetch } = useMarketScore()

  return (
    <GaugeCard
      testId="market-score-card"
      title={
        <>
          <Gauge className="h-4 w-4 text-primary" />
          {t('title')}
        </>
      }
      subtitle={t('cardSubtitle')}
      footer={
        <Link
          href="/score"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t('cardLink')}
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
      loading={isLoading && !data ? <Skeleton className="h-14 w-32" /> : undefined}
      aside={
        !isLoading && !data ? (
          <div className="flex flex-col items-end gap-2">
            <DataStatus updatedAt={null} unavailable />
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t('retry')}
            </Button>
          </div>
        ) : undefined
      }
      value={data?.score ?? null}
      valueClass={bandColorClass(data?.band ?? null)}
      caption={
        data
          ? `${data.band ? t(`bands.${data.band}`) : t('bands.unavailable')}${data.partial && data.score !== null ? ` · ${t('partialShort')}` : ''}`
          : undefined
      }
      meterGradient={SCORE_METER_GRADIENT}
    />
  )
}
