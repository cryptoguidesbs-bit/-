'use client'

import { ArrowDownRight, ArrowUpRight, ExternalLink, Fish, Waves } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'

import { formatCompactUsd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type MarketResult<T> = { data: T | null; stale: boolean; updatedAt: string | null }

type WhaleData = {
  txs: { hash: string; time: string; valueBtc: number; valueUsd: number }[]
  flow: {
    inflowUsd: number
    outflowUsd: number
    netUsd: number
    sampleSize: number
    matchedCount: number
  } | null
}

type SeriesMetric = {
  latest: number
  changePct: number | null
  series: { t: number; v: number }[]
}

type SummaryData = {
  network: MarketResult<{
    activeAddresses: SeriesMetric
    transactions: SeriesMetric
    hashRate: SeriesMetric
    minerRevenue: SeriesMetric
  }>
  stablecoins: MarketResult<
    { symbol: string; name: string; marketCap: number; changePct24h: number | null }[]
  >
}

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

function Sparkline({ series }: { series: { t: number; v: number }[] }) {
  if (series.length < 2) return null
  const values = series.map((p) => p.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = series
    .map((p, i) => `${(i / (series.length - 1)) * 100},${36 - ((p.v - min) / range) * 32}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function MetricCard({
  label,
  metric,
  format,
}: {
  label: string
  metric?: SeriesMetric
  format: (v: number) => string
}) {
  return (
    <Card data-testid={`metric-${label}`}>
      <CardContent className="space-y-2 p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {metric ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-lg font-bold tabular-nums">{format(metric.latest)}</p>
              {metric.changePct !== null && (
                <span
                  className={cn(
                    'flex items-center text-xs tabular-nums',
                    metric.changePct >= 0 ? 'text-emerald-500' : 'text-red-500',
                  )}
                >
                  {metric.changePct >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(metric.changePct).toFixed(1)}%
                </span>
              )}
            </div>
            <Sparkline series={metric.series} />
          </>
        ) : (
          <Skeleton className="h-16 w-full" />
        )}
      </CardContent>
    </Card>
  )
}

export function OnchainDashboard() {
  const t = useTranslations('onchain')
  const format = useFormatter()

  const whales = useQuery({
    queryKey: ['onchain', 'whales'],
    queryFn: async () => {
      const res = await fetch('/api/onchain/whales')
      if (!res.ok) throw new Error(`whales → ${res.status}`)
      return (await res.json()) as MarketResult<WhaleData>
    },
    refetchInterval: 60_000,
  })

  const summary = useQuery({
    queryKey: ['onchain', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/onchain/summary')
      if (!res.ok) throw new Error(`summary → ${res.status}`)
      return (await res.json()) as SummaryData
    },
    refetchInterval: 5 * 60_000,
  })

  const flow = whales.data?.data?.flow
  const network = summary.data?.network.data
  const stablecoins = summary.data?.stablecoins.data

  return (
    <div className="space-y-6" data-testid="onchain-dashboard">
      {/* Whale tracker */}
      <Card data-testid="whale-tracker">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Fish className="h-5 w-5 text-primary" />
            {t('whaleTitle')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('whaleSubtitle')}</p>
        </CardHeader>
        <CardContent>
          {whales.isLoading && <Skeleton className="h-32 w-full" />}
          <ul className="divide-y">
            {whales.data?.data?.txs.slice(0, 10).map((tx) => (
              <li key={tx.hash} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a
                  href={`https://blockchair.com/bitcoin/transaction/${tx.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-primary"
                >
                  {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="text-muted-foreground">{tx.valueBtc.toFixed(1)} BTC</span>
                  <span className="font-medium">{formatCompactUsd(tx.valueUsd)}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {format.relativeTime(new Date(tx.time.endsWith('Z') ? tx.time : `${tx.time}Z`))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {whales.data?.data && whales.data.data.txs.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('whaleEmpty')}</p>
          )}
        </CardContent>
      </Card>

      {/* Exchange flow */}
      <Card data-testid="exchange-flow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Waves className="h-5 w-5 text-primary" />
            {t('flowTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {flow ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{t('inflow')}</p>
                <p className="text-xl font-bold tabular-nums text-emerald-500">
                  {formatCompactUsd(flow.inflowUsd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('outflow')}</p>
                <p className="text-xl font-bold tabular-nums text-red-500">
                  {formatCompactUsd(flow.outflowUsd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('netflow')}</p>
                <p
                  className={cn(
                    'text-xl font-bold tabular-nums',
                    flow.netUsd >= 0 ? 'text-emerald-500' : 'text-red-500',
                  )}
                >
                  {flow.netUsd >= 0 ? '+' : ''}
                  {formatCompactUsd(flow.netUsd)}
                </p>
              </div>
            </div>
          ) : (
            <Skeleton className="h-14 w-full" />
          )}
          {flow && (
            <p className="text-xs text-muted-foreground">
              {t('flowMethod', { sample: flow.sampleSize, matched: flow.matchedCount })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Network activity */}
      <div className="space-y-3" data-testid="network-activity">
        <p className="text-sm font-medium text-muted-foreground">{t('networkTitle')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={t('activeAddresses')}
            metric={network?.activeAddresses}
            format={(v) => compactNumber.format(v)}
          />
          <MetricCard
            label={t('transactions')}
            metric={network?.transactions}
            format={(v) => compactNumber.format(v)}
          />
          <MetricCard
            label={t('hashRate')}
            metric={network?.hashRate}
            format={(v) => `${compactNumber.format(v / 1e6)} EH/s`}
          />
          <MetricCard
            label={t('minerRevenue')}
            metric={network?.minerRevenue}
            format={(v) => formatCompactUsd(v)}
          />
        </div>
      </div>

      {/* Stablecoin supply */}
      <div className="space-y-3" data-testid="stablecoin-supply">
        <p className="text-sm font-medium text-muted-foreground">{t('stablecoinTitle')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(stablecoins ?? []).map((coin) => (
            <Card key={coin.symbol}>
              <CardContent className="space-y-1 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{coin.symbol}</p>
                  {coin.changePct24h !== null && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'tabular-nums',
                        coin.changePct24h >= 0 ? 'text-emerald-500' : 'text-red-500',
                      )}
                    >
                      {coin.changePct24h >= 0 ? '+' : ''}
                      {coin.changePct24h.toFixed(2)}%
                    </Badge>
                  )}
                </div>
                <p className="text-lg font-bold tabular-nums">{formatCompactUsd(coin.marketCap)}</p>
                <p className="text-xs text-muted-foreground">{coin.name}</p>
              </CardContent>
            </Card>
          ))}
          {summary.isLoading &&
            Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t('sources')}</p>
    </div>
  )
}
