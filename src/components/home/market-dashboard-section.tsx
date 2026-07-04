'use client'

import { useTranslations } from 'next-intl'

import { marketSymbols } from '@/config/market'
import { useMarketPrices } from '@/hooks/use-market-prices'
import { formatCompactUsd, formatPercent, formatUsd } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Section } from '@/components/home/section'
import { cn } from '@/lib/utils'

export function MarketDashboardSection() {
  const t = useTranslations('home.dashboard')
  const { prices } = useMarketPrices()

  return (
    <Section id="market" title={t('title')} subtitle={t('subtitle')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {marketSymbols.map((m) => {
          const data = prices[m.symbol]
          return (
            <Card key={m.symbol}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{m.base}</p>
                    <p className="text-xs text-muted-foreground">{m.name}</p>
                  </div>
                  {data ? (
                    <span
                      className={cn(
                        'rounded-md px-2 py-1 text-xs font-medium tabular-nums',
                        data.changePct >= 0
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-red-500/10 text-red-500',
                      )}
                    >
                      {formatPercent(data.changePct)}
                    </span>
                  ) : (
                    <Skeleton className="h-6 w-14" />
                  )}
                </div>
                <div className="mt-4 space-y-1">
                  {data ? (
                    <>
                      <p className="text-xl font-bold tabular-nums">{formatUsd(data.price)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('volume24h')}{' '}
                        <span className="tabular-nums">{formatCompactUsd(data.volumeQuote)}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <Skeleton className="h-7 w-28" />
                      <Skeleton className="h-4 w-20" />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t('source')}</p>
    </Section>
  )
}
