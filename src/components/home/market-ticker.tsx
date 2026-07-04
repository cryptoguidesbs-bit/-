'use client'

import { useTranslations } from 'next-intl'

import { marketSymbols } from '@/config/market'
import { useMarketPrices } from '@/hooks/use-market-prices'
import { formatPercent, formatUsd } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function TickerItem({ base, price, changePct }: { base: string; price: number; changePct: number }) {
  return (
    <span className="flex items-center gap-2 px-5 text-sm">
      <span className="font-semibold">{base}</span>
      <span className="tabular-nums text-muted-foreground">{formatUsd(price)}</span>
      <span
        className={cn(
          'tabular-nums',
          changePct >= 0 ? 'text-emerald-500' : 'text-red-500',
        )}
      >
        {formatPercent(changePct)}
      </span>
    </span>
  )
}

export function MarketTicker() {
  const t = useTranslations('home.ticker')
  const { prices, status } = useMarketPrices()

  const items = marketSymbols
    .map((m) => ({ ...m, data: prices[m.symbol] }))
    .filter((m) => m.data)

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center">
        <span className="flex shrink-0 items-center gap-1.5 border-r px-3 py-2.5 text-xs font-semibold">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              status === 'live' ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground',
            )}
          />
          {status === 'live' ? t('live') : t('connecting')}
        </span>

        {items.length === 0 ? (
          <div className="flex flex-1 items-center gap-6 px-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-32" />
            ))}
          </div>
        ) : (
          <div className="relative flex-1 overflow-hidden">
            <div className="animate-marquee flex w-max">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex" aria-hidden={copy === 1}>
                  {items.map((m) => (
                    <TickerItem
                      key={`${copy}-${m.symbol}`}
                      base={m.base}
                      price={m.data!.price}
                      changePct={m.data!.changePct}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
