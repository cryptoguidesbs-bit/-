'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { cryptoAssets, traditionalAssets } from '@/config/assets'
import { useCryptoPrices, useIndices, useSentiment } from '@/hooks/use-market-data'
import { useMarketPrices } from '@/hooks/use-market-prices'
import type { AssetQuote } from '@/lib/market/sources'
import { formatPercent, formatUsd } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Section } from '@/components/home/section'
import { cn } from '@/lib/utils'

const indexFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function StaleNotice({ updatedAt }: { updatedAt: string | null }) {
  const t = useTranslations('home.dashboard')
  const locale = useLocale()
  const time = updatedAt
    ? new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(updatedAt))
    : '—'

  return (
    <p
      className="flex items-center gap-1.5 text-xs text-yellow-500"
      data-testid="stale-notice"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {t('staleNotice', { time })}
    </p>
  )
}

function UnavailableCard({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('home.dashboard')
  return (
    <Card className="col-span-full" data-testid="market-unavailable">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <p className="text-sm text-muted-foreground">{t('unavailable')}</p>
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
                : 'bg-red-500/10 text-red-500',
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
// Fear & Greed gauge
// ---------------------------------------------------------------------------

const CLASSIFICATION_KEY: Record<string, string> = {
  'Extreme Fear': 'extremeFear',
  Fear: 'fear',
  Neutral: 'neutral',
  Greed: 'greed',
  'Extreme Greed': 'extremeGreed',
}

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

  return (
    <Card data-testid="fear-greed">
      <CardContent className="flex items-center justify-between gap-6 p-5">
        <div className="space-y-1">
          <p className="font-semibold">{t('fngTitle')}</p>
          <p className="text-xs text-muted-foreground">Crypto Fear &amp; Greed Index</p>
          {result?.stale && result.data && <StaleNotice updatedAt={result.updatedAt} />}
        </div>

        {isLoading && <Skeleton className="h-14 w-32" />}

        {!isLoading && result?.data && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={cn('text-4xl font-bold tabular-nums', fngColor(result.data.value))}>
                {result.data.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(`classification.${CLASSIFICATION_KEY[result.data.classification] ?? 'neutral'}`)}
              </p>
            </div>
            {/* 0–100 meter */}
            <div className="h-16 w-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="w-full rounded-full bg-gradient-to-t from-red-500 via-yellow-500 to-emerald-500"
                style={{ height: `${result.data.value}%`, marginTop: `${100 - result.data.value}%` }}
              />
            </div>
          </div>
        )}

        {!isLoading && !result?.data && (
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('retry')}
          </Button>
        )}
      </CardContent>
    </Card>
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
        <FearGreedCard />

        {/* Crypto */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{t('crypto')}</p>
            {crypto.data?.stale && crypto.data.data && (
              <StaleNotice updatedAt={crypto.data.updatedAt} />
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
              <StaleNotice updatedAt={indices.data.updatedAt} />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {indices.isLoading && <CardSkeletons count={6} />}
            {indices.data?.data?.map((quote) => {
              const asset = traditionalAssets.find((a) => a.id === quote.id)
              const formatted =
                asset?.kind === 'commodity' ? formatUsd(quote.price) : indexFormat.format(quote.price)
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
