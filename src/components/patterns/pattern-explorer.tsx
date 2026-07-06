'use client'

import { useState } from 'react'
import { AlertTriangle, Shapes } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Localized = { ko: string; en: string }

type PatternsResponse = {
  symbol: string
  interval: string
  available: boolean
  stale: boolean
  patterns: {
    type: string
    confidence: number
    description: Localized
  }[]
  levels: {
    kind: 'support' | 'resistance'
    price: number
    touches: number
    confidence: number
    description: Localized
  }[]
  closes: number[]
}

const SYMBOLS = ['BTC', 'ETH', 'SOL'] as const
const INTERVALS = ['1h', '4h', '1d'] as const

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function PriceChart({
  closes,
  levels,
}: {
  closes: number[]
  levels: PatternsResponse['levels']
}) {
  if (closes.length < 2) return null
  const min = Math.min(...closes, ...levels.map((l) => l.price))
  const max = Math.max(...closes, ...levels.map((l) => l.price))
  const range = max - min || 1
  const y = (v: number) => 78 - ((v - min) / range) * 72
  const points = closes.map((v, i) => `${(i / (closes.length - 1)) * 100},${y(v)}`).join(' ')

  return (
    <svg viewBox="0 0 100 80" className="h-48 w-full" preserveAspectRatio="none" aria-hidden>
      {levels.map((level) => (
        <line
          key={`${level.kind}-${level.price}`}
          x1="0"
          x2="100"
          y1={y(level.price)}
          y2={y(level.price)}
          stroke={level.kind === 'support' ? '#34d399' : '#f87171'}
          strokeWidth="0.6"
          strokeDasharray="2 2"
          opacity="0.7"
        />
      ))}
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// Confidence 0–100 shape-match bar (explicitly labeled: not a prediction).
function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  )
}

export function PatternExplorer() {
  const t = useTranslations('patterns')
  const locale = useLocale()
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en'
  const [symbol, setSymbol] = useState<string>('BTC')
  const [interval, setIntervalValue] = useState<string>('4h')

  const { data, isLoading } = useQuery({
    queryKey: ['patterns', symbol, interval],
    queryFn: async () => {
      const res = await fetch(`/api/patterns?symbol=${symbol}&interval=${interval}`)
      if (!res.ok) throw new Error(`patterns → ${res.status}`)
      return (await res.json()) as PatternsResponse
    },
    refetchInterval: 5 * 60_000,
  })

  return (
    <div className="space-y-4" data-testid="pattern-explorer">
      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-2">
        {SYMBOLS.map((s) => (
          <Chip key={s} active={symbol === s} onClick={() => setSymbol(s)}>
            {s}
          </Chip>
        ))}
        <span className="mx-1 text-muted-foreground">·</span>
        {INTERVALS.map((i) => (
          <Chip key={i} active={interval === i} onClick={() => setIntervalValue(i)}>
            {i}
          </Chip>
        ))}
      </div>

      {/* Chart with S/R overlay */}
      <Card>
        <CardContent className="p-4">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {data?.available && <PriceChart closes={data.closes} levels={data.levels} />}
          {data && !data.available && (
            <p className="py-12 text-center text-sm text-muted-foreground">{t('unavailable')}</p>
          )}
        </CardContent>
      </Card>

      {/* Detected patterns */}
      <Card data-testid="patterns-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shapes className="h-5 w-5 text-primary" />
            {t('detectedTitle')}
          </CardTitle>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
            {t('confidenceNote')}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-24 w-full" />}
          <ul className="divide-y">
            {data?.patterns.map((pattern) => (
              <li key={pattern.type} className="space-y-1.5 py-3" data-testid={`pattern-${pattern.type}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="secondary">{t(`types.${pattern.type}`)}</Badge>
                  <ConfidenceBar value={pattern.confidence} />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {pattern.description[lang]}
                </p>
              </li>
            ))}
          </ul>
          {data?.available && data.patterns.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </CardContent>
      </Card>

      {/* Support / resistance */}
      <Card data-testid="levels-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('levelsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-16 w-full" />}
          <ul className="divide-y">
            {data?.levels.map((level) => (
              <li
                key={`${level.kind}-${level.price}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      level.kind === 'support' ? 'bg-emerald-500' : 'bg-red-500',
                    )}
                  />
                  {level.description[lang]}
                </span>
                <ConfidenceBar value={level.confidence} />
              </li>
            ))}
          </ul>
          {data?.available && data.levels.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
