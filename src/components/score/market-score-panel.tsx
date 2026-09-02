'use client'

import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useMarketScore } from '@/hooks/use-market-data'
import type { ScoreComponent, ScoreComponentKey } from '@/lib/market/score'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DataStatus } from '@/components/data-status'
import { MarketScoreGauge, bandColorClass } from '@/components/score/market-score-gauge'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

const COMPONENT_ORDER: ScoreComponentKey[] = [
  'momentum',
  'marketCap',
  'breadth',
  'fearGreed',
  'newsTone',
  'stability',
]

const signed = (v: number, digits = 2) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`

// Raw value rendered in its natural unit — the "DATA" half of DATA → SCORE.
function rawLabel(c: ScoreComponent): string {
  if (c.raw === null) return '—'
  switch (c.key) {
    case 'momentum':
    case 'marketCap':
      return `${signed(c.raw)}%`
    case 'stability':
      return `±${Math.abs(c.raw).toFixed(2)}%`
    case 'breadth':
      return `${Math.round(c.raw)}%`
    case 'fearGreed':
      return `${Math.round(c.raw)}`
    case 'newsTone':
      return signed(c.raw, 0)
  }
}

function ComponentRow({ c }: { c: ScoreComponent }) {
  const t = useTranslations('score.components')
  const pct = c.normalized ?? 0
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]',
        !c.available && 'opacity-60'
      )}
      data-testid={`score-component-${c.key}`}
    >
      <div>
        <p className="text-sm font-medium">{t(`${c.key}.name`)}</p>
        <p className="text-xs text-muted-foreground">{t(`${c.key}.explain`)}</p>
      </div>
      <p className="text-right text-sm tabular-nums sm:text-left">{rawLabel(c)}</p>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-red-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
          {c.normalized ?? '—'}
        </span>
      </div>
      <p className="text-right text-xs tabular-nums text-muted-foreground">
        {c.available
          ? t('weightWithContribution', {
              // When an input is missing the remaining weights are rescaled —
              // show the weight that was actually applied.
              weight: c.effectiveWeight ?? c.weight,
              contribution: c.contribution ?? 0,
            })
          : t('unavailable')}
      </p>
    </div>
  )
}

export function MarketScorePanel() {
  const t = useTranslations('score')
  const tc = useTranslations('score.components')
  const { data, isLoading, refetch } = useMarketScore()

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <Skeleton className="h-32 w-60" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <DataStatus updatedAt={null} unavailable />
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const ordered = COMPONENT_ORDER.map((k) => data.components.find((c) => c.key === k)).filter(
    Boolean
  ) as ScoreComponent[]
  const missingNames = data.missing.map((k) => tc(`${k}.name`))
  const bandLabel = data.band ? t(`bands.${data.band}`) : t('bands.unavailable')

  return (
    <div className="space-y-6" data-testid="market-score-panel">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <MarketScoreGauge score={data.score} band={data.band} label={bandLabel} />
          <div className="max-w-md space-y-3 text-center md:text-left">
            <p className={cn('text-lg font-semibold', bandColorClass(data.band))}>
              {data.band ? t(`bandSummary.${data.band}`) : t('bandSummary.unavailable')}
            </p>
            <p className="text-sm text-muted-foreground">{t('howToRead')}</p>
            <DataStatus
              updatedAt={data.computedAt}
              stale={data.stale}
              partial={data.partial}
              unavailable={data.score === null}
              missing={missingNames}
              className="justify-center md:justify-start"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">{t('reasonTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('reasonSubtitle')}</p>
          </div>
          <div className="mt-3 hidden grid-cols-[1.4fr_1fr_1fr_auto] gap-x-4 border-b pb-2 text-xs text-muted-foreground sm:grid">
            <span>{t('columns.input')}</span>
            <span>{t('columns.raw')}</span>
            <span>{t('columns.normalized')}</span>
            <span className="text-right">{t('columns.weight')}</span>
          </div>
          <div className="divide-y">
            {ordered.map((c) => (
              <ComponentRow key={c.key} c={c} />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t('methodNote')}{' '}
            <Link href="/data#score" className="font-medium text-primary hover:underline">
              {t('methodLink')}
            </Link>
          </p>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground" data-testid="score-disclaimer">
        {t('disclaimer')}
      </p>
    </div>
  )
}
