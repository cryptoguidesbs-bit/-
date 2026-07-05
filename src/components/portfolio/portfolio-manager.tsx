'use client'

import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { formatUsd } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type PortfolioData = {
  items: {
    id: string
    symbol: string
    quantity: number
    avgCost: number
    price: number | null
    value: number | null
  }[]
  totalValue: number
  totalCost: number
}

function Row({
  item,
  onSaved,
}: {
  item: PortfolioData['items'][number]
  onSaved: () => void
}) {
  const t = useTranslations('dashboard.portfolio')
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [avgCost, setAvgCost] = useState(String(item.avgCost))
  const dirty = Number(quantity) !== item.quantity || Number(avgCost) !== item.avgCost

  const update = useMutation({
    mutationFn: () =>
      fetch(`/api/me/portfolio/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: Number(quantity), avgCost: Number(avgCost) }),
      }),
    onSuccess: onSaved,
  })
  const remove = useMutation({
    mutationFn: () => fetch(`/api/me/portfolio/${item.id}`, { method: 'DELETE' }),
    onSuccess: onSaved,
  })

  const diff =
    item.value !== null && item.quantity * item.avgCost > 0
      ? item.value - item.quantity * item.avgCost
      : null

  return (
    <tr className="border-b text-sm" data-testid={`holding-${item.symbol}`}>
      <td className="py-2.5 font-medium">{item.symbol}</td>
      <td className="px-2">
        <input
          type="number"
          value={quantity}
          min="0"
          step="any"
          onChange={(event) => setQuantity(event.target.value)}
          className="w-24 rounded-md border bg-card px-2 py-1 text-right tabular-nums outline-none focus:border-primary"
        />
      </td>
      <td className="px-2">
        <input
          type="number"
          value={avgCost}
          min="0"
          step="any"
          onChange={(event) => setAvgCost(event.target.value)}
          className="w-28 rounded-md border bg-card px-2 py-1 text-right tabular-nums outline-none focus:border-primary"
        />
      </td>
      <td className="px-2 text-right tabular-nums text-muted-foreground">
        {item.price !== null ? formatUsd(item.price) : '—'}
      </td>
      <td className="px-2 text-right font-medium tabular-nums">
        {item.value !== null ? formatUsd(item.value) : '—'}
      </td>
      <td
        className={cn(
          'px-2 text-right tabular-nums',
          diff === null ? 'text-muted-foreground' : diff >= 0 ? 'text-emerald-500' : 'text-red-500',
        )}
      >
        {diff !== null ? `${diff >= 0 ? '+' : ''}${formatUsd(diff)}` : '—'}
      </td>
      <td className="py-2.5 pl-2 text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('save')}
            disabled={!dirty || update.isPending}
            onClick={() => update.mutate()}
          >
            <Save className={cn('h-4 w-4', dirty ? 'text-primary' : 'text-muted-foreground')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('remove')}
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

export function PortfolioManager() {
  const t = useTranslations('dashboard.portfolio')
  const queryClient = useQueryClient()
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'portfolio'],
    queryFn: async () => {
      const res = await fetch('/api/me/portfolio')
      if (!res.ok) throw new Error(`portfolio → ${res.status}`)
      return (await res.json()) as PortfolioData
    },
    refetchInterval: 30_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['me', 'portfolio'] })

  const add = useMutation({
    mutationFn: async () => {
      setError('')
      const res = await fetch('/api/me/portfolio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol,
          quantity: Number(quantity),
          avgCost: Number(avgCost),
        }),
      })
      if (!res.ok) throw new Error(t('invalid'))
    },
    onSuccess: () => {
      setSymbol('')
      setQuantity('')
      setAvgCost('')
      invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="space-y-4" data-testid="portfolio-manager">
      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">{t('totalValue')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {data ? formatUsd(data.totalValue) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">{t('totalCost')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {data ? formatUsd(data.totalCost) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add form */}
      <Card>
        <CardContent className="p-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (symbol && Number(quantity) > 0) add.mutate()
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('symbol')}
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                placeholder="BTC"
                maxLength={10}
                data-testid="portfolio-symbol"
                className="w-24 rounded-md border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('quantity')}
              <input
                type="number"
                value={quantity}
                min="0"
                step="any"
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0.5"
                className="w-28 rounded-md border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('avgCost')}
              <input
                type="number"
                value={avgCost}
                min="0"
                step="any"
                onChange={(event) => setAvgCost(event.target.value)}
                placeholder="30000"
                className="w-32 rounded-md border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <Button type="submit" size="sm" disabled={add.isPending}>
              <Plus className="mr-1 h-4 w-4" />
              {t('add')}
            </Button>
          </form>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {/* Holdings table */}
      <Card>
        <CardContent className="overflow-x-auto p-4">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {data && data.items.length > 0 && (
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">{t('symbol')}</th>
                  <th className="px-2 font-medium">{t('quantity')}</th>
                  <th className="px-2 font-medium">{t('avgCost')}</th>
                  <th className="px-2 text-right font-medium">{t('price')}</th>
                  <th className="px-2 text-right font-medium">{t('value')}</th>
                  <th className="px-2 text-right font-medium">{t('diff')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <Row key={item.id} item={item} onSaved={invalidate} />
                ))}
              </tbody>
            </table>
          )}
          {data && data.items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t('note')}</p>
    </div>
  )
}
