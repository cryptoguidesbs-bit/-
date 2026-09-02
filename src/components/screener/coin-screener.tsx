'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, RefreshCw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useScreener } from '@/hooks/use-market-data'
import type { ScreenerRow } from '@/lib/market/screener-sources'
import { formatCompactUsd, formatPercent, formatUsd } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataStatus } from '@/components/data-status'
import { cn } from '@/lib/utils'

type SortKey = 'rank' | 'price' | 'change1hPct' | 'change24hPct' | 'change7dPct' | 'volume24hUsd' | 'marketCapUsd'
type Preset = 'all' | 'gainers' | 'losers' | 'volume'

const COLUMNS: { key: SortKey; align: 'left' | 'right' }[] = [
  { key: 'rank', align: 'left' },
  { key: 'price', align: 'right' },
  { key: 'change1hPct', align: 'right' },
  { key: 'change24hPct', align: 'right' },
  { key: 'change7dPct', align: 'right' },
  { key: 'volume24hUsd', align: 'right' },
  { key: 'marketCapUsd', align: 'right' },
]

function Pct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn('tabular-nums', value > 0 ? 'text-emerald-500' : value < 0 ? 'text-red-500' : 'text-muted-foreground')}>
      {formatPercent(value)}
    </span>
  )
}

export function CoinScreener() {
  const t = useTranslations('screener')
  const { data: result, isLoading, refetch } = useScreener()
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [desc, setDesc] = useState(false)
  const [preset, setPreset] = useState<Preset>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    let list: ScreenerRow[] = result?.data ? [...result.data] : []
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))

    // Presets are plain views of the same table — top movers by size of
    // move, or by turnover. They are not recommendations of any kind.
    if (preset === 'gainers') list = list.filter((r) => (r.change24hPct ?? 0) > 0).sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0)).slice(0, 20)
    else if (preset === 'losers') list = list.filter((r) => (r.change24hPct ?? 0) < 0).sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0)).slice(0, 20)
    else if (preset === 'volume') list = list.sort((a, b) => b.volume24hUsd - a.volume24hUsd).slice(0, 20)
    else {
      list.sort((a, b) => {
        const av = a[sortKey] ?? Number.NEGATIVE_INFINITY
        const bv = b[sortKey] ?? Number.NEGATIVE_INFINITY
        return desc ? (bv as number) - (av as number) : (av as number) - (bv as number)
      })
    }
    return list
  }, [result, query, preset, sortKey, desc])

  const toggleSort = (key: SortKey) => {
    setPreset('all')
    if (sortKey === key) setDesc((d) => !d)
    else {
      setSortKey(key)
      setDesc(key !== 'rank')
    }
  }

  return (
    <div className="space-y-4" data-testid="coin-screener">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', 'gainers', 'losers', 'volume'] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              aria-pressed={preset === p}
              data-testid={`screener-preset-${p}`}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                preset === p ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`presets.${p}`)}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            data-testid="screener-search"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {result ? (
          <DataStatus updatedAt={result.updatedAt} stale={result.stale} unavailable={!result.data} />
        ) : (
          <span />
        )}
        {result && !result.data && (
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('retry')}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm" data-testid="screener-table">
          <thead>
            <tr className="border-b bg-card/50 text-xs text-muted-foreground">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn('whitespace-nowrap px-3 py-2 font-medium', col.align === 'right' ? 'text-right' : 'text-left')}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn('inline-flex items-center gap-1 hover:text-foreground', sortKey === col.key && preset === 'all' && 'text-foreground')}
                  >
                    {t(`columns.${col.key}`)}
                    {sortKey === col.key && preset === 'all' && (desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && rows.length === 0 &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td colSpan={COLUMNS.length} className="px-3 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-card/50" data-testid={`screener-row-${r.symbol}`}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs tabular-nums text-muted-foreground">{r.rank}</span>
                    <span className="font-semibold" translate="no">{r.symbol}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{r.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatUsd(r.price)}</td>
                <td className="px-3 py-2.5 text-right"><Pct value={r.change1hPct} /></td>
                <td className="px-3 py-2.5 text-right"><Pct value={r.change24hPct} /></td>
                <td className="px-3 py-2.5 text-right"><Pct value={r.change7dPct} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatCompactUsd(r.volume24hUsd)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatCompactUsd(r.marketCapUsd)}</td>
              </tr>
            ))}
            {!isLoading && result?.data && rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('noMatch')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground" data-testid="screener-disclaimer">
        {t('disclaimer')}
      </p>
    </div>
  )
}
