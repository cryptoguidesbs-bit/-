'use client'

import { useState } from 'react'
import { PieChart, Sparkles } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { formatUsd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Analytics = {
  holdings: {
    symbol: string
    value: number | null
    pnl: number | null
    pnlPct: number | null
    weightPct: number | null
  }[]
  totals: {
    value: number
    cost: number
    pnl: number
    pnlPct: number | null
    unpricedCount: number
  }
  diversification: {
    hhi: number | null
    effectiveAssets: number | null
    topSymbol: string | null
    topWeightPct: number | null
    concentration: 'diversified' | 'moderate' | 'concentrated' | null
  }
}

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c']

// SVG donut built from stroke-dasharray arcs — no chart library needed.
function AllocationDonut({ slices }: { slices: { symbol: string; weightPct: number }[] }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <svg viewBox="0 0 100 100" className="h-40 w-40" role="img" aria-label="allocation chart">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="14" />
      {slices.map((slice, index) => {
        const fraction = slice.weightPct / 100
        const dash = fraction * circumference
        const element = (
          <circle
            key={slice.symbol}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={COLORS[index % COLORS.length]}
            strokeWidth="14"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        )
        offset += dash
        return element
      })}
    </svg>
  )
}

export function PortfolioAnalytics() {
  const t = useTranslations('portfolioAnalytics')
  const locale = useLocale()
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en'
  const [commentary, setCommentary] = useState<{ text: string; model: string } | null>(null)
  const [insightError, setInsightError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'portfolio-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/me/portfolio/analytics')
      if (!res.ok) throw new Error(`analytics → ${res.status}`)
      return (await res.json()) as Analytics
    },
    refetchInterval: 30_000,
  })

  const insight = useMutation({
    mutationFn: async () => {
      setInsightError('')
      const res = await fetch('/api/me/portfolio/insight', { method: 'POST' })
      const json = await res.json()
      if (json.blocked) throw new Error(t('aiBlocked'))
      if (!res.ok) throw new Error(t('aiFailed'))
      return json as { commentary: { ko: string; en: string }; aiModel: string }
    },
    onSuccess: (json) =>
      setCommentary({ text: json.commentary[lang], model: json.aiModel }),
    onError: (e: Error) => setInsightError(e.message),
  })

  if (isLoading) return <Skeleton className="h-48 w-full" data-testid="analytics-loading" />
  if (!data || data.holdings.length === 0) return null

  const slices = data.holdings
    .filter((h) => h.weightPct !== null)
    .sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0))
    .map((h) => ({ symbol: h.symbol, weightPct: h.weightPct as number }))
  const d = data.diversification

  return (
    <div className="space-y-4" data-testid="portfolio-analytics">
      {/* P&L */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">{t('pnl')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                'text-2xl font-bold tabular-nums',
                data.totals.pnl >= 0 ? 'text-emerald-500' : 'text-red-500',
              )}
              data-testid="total-pnl"
            >
              {data.totals.pnl >= 0 ? '+' : ''}
              {formatUsd(data.totals.pnl)}
            </p>
            {data.totals.pnlPct !== null && (
              <p className="text-sm tabular-nums text-muted-foreground">
                {data.totals.pnlPct >= 0 ? '+' : ''}
                {data.totals.pnlPct.toFixed(2)}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">{t('assetChart')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {slices.map((slice, index) => (
              <div key={slice.symbol} className="flex items-center gap-2 text-xs">
                <span className="w-12 font-medium">{slice.symbol}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${slice.weightPct}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums text-muted-foreground">
                  {slice.weightPct.toFixed(1)}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Allocation + diversification */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="allocation-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5 text-primary" />
              {t('allocation')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <AllocationDonut slices={slices} />
            <ul className="space-y-1.5 text-sm">
              {slices.map((slice, index) => (
                <li key={slice.symbol} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-medium">{slice.symbol}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {slice.weightPct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card data-testid="diversification-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('diversification')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {d.concentration && (
              <Badge variant="secondary">{t(`concentration.${d.concentration}`)}</Badge>
            )}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">HHI</span>
                <span className="font-medium tabular-nums">{d.hhi?.toFixed(3) ?? '—'}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{t('hhiExplain')}</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('effectiveAssets')}</span>
                <span className="font-medium tabular-nums">
                  {d.effectiveAssets?.toFixed(2) ?? '—'}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('effectiveExplain')}
              </p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('topWeight')}</span>
                <span className="font-medium tabular-nums">
                  {d.topSymbol} {d.topWeightPct?.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI educational commentary (A-2-7: explanation only) */}
      <Card data-testid="ai-insight-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('aiTitle')}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={insight.isPending || slices.length === 0}
            onClick={() => insight.mutate()}
            data-testid="ai-insight-generate"
          >
            {insight.isPending ? t('aiGenerating') : t('aiGenerate')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {commentary ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">{commentary.text}</p>
              <p className="flex items-center gap-1.5 text-xs text-primary">
                <Sparkles className="h-3 w-3" />
                {t('aiLabel', { model: commentary.model })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('aiEmpty')}</p>
          )}
          {insightError && <p className="text-xs text-red-500">{insightError}</p>}
          <p className="border-t pt-3 text-xs text-muted-foreground">{t('aiDisclaimer')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
