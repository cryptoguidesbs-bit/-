'use client'

import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cryptoAssets, traditionalAssets } from '@/config/assets'
import { useCryptoPrices, useIndices, useSentiment } from '@/hooks/use-market-data'
import { useMarketPrices } from '@/hooks/use-market-prices'
import type { AssetQuote } from '@/lib/market/sources'
import { formatPercent, formatUsd } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DataStatus } from '@/components/data-status'
import { GaugeCard } from '@/components/home/gauge-card'
import { Section } from '@/components/home/section'
import { MarketScoreCard } from '@/components/score/market-score-card'
import { cn } from '@/lib/utils'

const indexFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

// Nothing to show (no last-good value either): say so, offer a retry. The
// wording comes from the site-wide DataStatus convention.
function UnavailableCard({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('home.dashboard')
  return (
    <Card className="col-span-full" data-testid="market-unavailable">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <DataStatus updatedAt={null} unavailable />
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {t('retry')}
        </Button>
      </CardContent>
    </Card>
  )
}

function AssetCard({
  quote,
  formatted,
  live,
}: {
  quote: AssetQuote
  formatted: string
  live?: boolean
}) {
  const t = useTranslations('home.dashboard')
  return (
    <Card data-testid={`asset-${quote.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{quote.id}</p>
            <p className="text-xs text-muted-foreground">{quote.name}</p>
          </div>
          <span
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium tabular-nums',
              quote.changePct >= 0
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-red-500/10 text-red-500'
            )}
          >
            {formatPercent(quote.changePct)}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-xl font-bold tabular-nums">{formatted}</p>
          {live && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t('live')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CardSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Fear & Greed gauge — low = fear (red), high = greed (green)
// ---------------------------------------------------------------------------

const CLASSIFICATION_KEY: Record<string, string> = {
  'Extreme Fear': 'extremeFear',
  Fear: 'fear',
  Neutral: 'neutral',
  Greed: 'greed',
  'Extreme Greed': 'extremeGreed',
}

const FNG_METER_GRADIENT = 'bg-gradient-to-t from-red-500 via-yellow-500 to-emerald-500'

function fngColor(value: number) {
  if (value <= 24) return 'text-red-500'
  if (value <= 44) return 'text-orange-500'
  if (value <= 55) return 'text-yellow-500'
  if (value <= 75) return 'text-emerald-400'
  return 'text-emerald-500'
}

function FearGreedCard() {
  const t = useTranslations('home.dashboard')
  const { data: result, isLoading, refetch } = useSentiment()
  const value = result?.data?.value ?? null

  return (
    <GaugeCard
      testId="fear-greed"
      title={t('fngTitle')}
      subtitle="Crypto Fear & Greed Index"
      footer={
        result?.stale && result.data ? <DataStatus updatedAt={result.updatedAt} stale /> : undefined
      }
      loading={isLoading && value === null ? <Skeleton className="h-14 w-32" /> : undefined}
      aside={
        !isLoading && value === null ? (
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('retry')}
          </Button>
        ) : undefined
      }
      value={value}
      valueClass={value === null ? undefined : fngColor(value)}
      caption={
        result?.data
          ? t(`classification.${CLASSIFICATION_KEY[result.data.classification] ?? 'neutral'}`)
          : undefined
      }
      meterGradient={FNG_METER_GRADIENT}
    />
  )
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function MarketDashboardSection() {
  const t = useTranslations('home.dashboard')
  const crypto = useCryptoPrices()
  const indices = useIndices()
  // Live Binance stream (stage 3) — overrides REST snapshots when connected.
  const { prices: livePrices } = useMarketPrices()

  const cryptoQuotes: (AssetQuote & { live: boolean })[] | null = crypto.data?.data
    ? crypto.data.data.map((quote) => {
        const asset = cryptoAssets.find((a) => a.id === quote.id)
        const live = asset ? livePrices[asset.binanceSymbol] : undefined
        return live
          ? { ...quote, price: live.price, changePct: live.changePct, live: true }
          : { ...quote, live: false }
      })
    : null

  return (
    <Section id="market" title={t('title')} subtitle={t('subtitle')}>
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <MarketScoreCard />
          <FearGreedCard />
        </div>

        {/* Crypto */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{t('crypto')}</p>
            {crypto.data?.stale && crypto.data.data && (
              <DataStatus updatedAt={crypto.data.updatedAt} stale />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {crypto.isLoading && <CardSkeletons count={3} />}
            {cryptoQuotes?.map((quote) => (
              <AssetCard
                key={quote.id}
                quote={quote}
                formatted={formatUsd(quote.price)}
                live={quote.live}
              />
            ))}
            {!crypto.isLoading && !crypto.data?.data && (
              <UnavailableCard onRetry={() => void crypto.refetch()} />
            )}
          </div>
        </div>

        {/* Traditional markets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{t('traditional')}</p>
            {indices.data?.stale && indices.data.data && (
              <DataStatus updatedAt={indices.data.updatedAt} stale />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {indices.isLoading && <CardSkeletons count={6} />}
            {indices.data?.data?.map((quote) => {
              const asset = traditionalAssets.find((a) => a.id === quote.id)
              const formatted =
                asset?.kind === 'commodity'
                  ? formatUsd(quote.price)
                  : indexFormat.format(quote.price)
              return <AssetCard key={quote.id} quote={quote} formatted={formatted} />
            })}
            {!indices.isLoading && !indices.data?.data && (
              <UnavailableCard onRetry={() => void indices.refetch()} />
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">{t('source')}</p>
    </Section>
  )
}
