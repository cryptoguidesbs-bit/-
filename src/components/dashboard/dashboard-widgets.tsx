'use client'

import { useState } from 'react'
import { Bell, BellOff, Bookmark, Check, Eye, Plus, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'

import { formatUsd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

type WatchlistData = {
  items: { id: string; symbol: string; price: number | null }[]
}

export function WatchlistCard() {
  const t = useTranslations('dashboard.watchlist')
  const queryClient = useQueryClient()
  const [symbol, setSymbol] = useState('')
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'watchlist'],
    queryFn: () => getJson<WatchlistData>('/api/me/watchlist'),
    refetchInterval: 30_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['me', 'watchlist'] })

  const add = useMutation({
    mutationFn: async () => {
      setError('')
      const res = await fetch('/api/me/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol }),
      })
      if (res.status === 409) throw new Error(t('duplicate'))
      if (!res.ok) throw new Error(t('invalid'))
    },
    onSuccess: () => {
      setSymbol('')
      invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => fetch(`/api/me/watchlist/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  return (
    <Card data-testid="watchlist-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eye className="h-5 w-5 text-primary" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (symbol.trim()) add.mutate()
          }}
        >
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder={t('placeholder')}
            maxLength={10}
            data-testid="watchlist-input"
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <Button type="submit" size="sm" disabled={add.isPending || !symbol.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        {error && <p className="text-xs text-red-500">{error}</p>}

        {isLoading && <Skeleton className="h-20 w-full" />}

        <ul className="divide-y">
          {data?.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium">{item.symbol}</span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-muted-foreground">
                  {item.price !== null ? formatUsd(item.price) : '—'}
                </span>
                <button
                  type="button"
                  aria-label={t('remove')}
                  onClick={() => remove.mutate(item.id)}
                  className="text-muted-foreground transition-colors hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        {data && data.items.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

type NotificationsData = {
  items: {
    id: string
    title: string
    body: string | null
    href: string | null
    readAt: string | null
    createdAt: string
  }[]
  unreadCount: number
}

export function NotificationsCard() {
  const t = useTranslations('dashboard.notifications')
  const format = useFormatter()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'notifications'],
    queryFn: () => getJson<NotificationsData>('/api/me/notifications'),
    refetchInterval: 60_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['me', 'notifications'] })

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch('/api/me/notifications/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true }),
      }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => fetch(`/api/me/notifications/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  return (
    <Card data-testid="notifications-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" />
          {t('title')}
          {(data?.unreadCount ?? 0) > 0 && <Badge>{data?.unreadCount}</Badge>}
        </CardTitle>
        {(data?.unreadCount ?? 0) > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
            <Check className="mr-1 h-4 w-4" />
            {t('markAllRead')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-20 w-full" />}
        <ul className="divide-y">
          {data?.items.slice(0, 8).map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className={cn('text-sm', item.readAt ? 'text-muted-foreground' : 'font-medium')}>
                  {item.title}
                </p>
                {item.body && (
                  <p className="truncate text-xs text-muted-foreground">{item.body}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {format.relativeTime(new Date(item.createdAt))}
                </p>
              </div>
              <button
                type="button"
                aria-label={t('dismiss')}
                onClick={() => remove.mutate(item.id)}
                className="mt-1 shrink-0 text-muted-foreground transition-colors hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {data && data.items.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <BellOff className="h-4 w-4" />
            {t('empty')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Saved articles / reports
// ---------------------------------------------------------------------------

type SavedArticlesData = {
  items: { newsItemId: string; title: string; url: string; source: string; savedAt: string }[]
}

export function SavedArticlesCard() {
  const t = useTranslations('dashboard.savedArticles')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'saved-articles'],
    queryFn: () => getJson<SavedArticlesData>('/api/me/saved-articles'),
  })

  const remove = useMutation({
    mutationFn: (newsItemId: string) =>
      fetch(`/api/me/saved-articles/${newsItemId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'saved-articles'] }),
  })

  return (
    <Card data-testid="saved-articles-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bookmark className="h-5 w-5 text-primary" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-20 w-full" />}
        <ul className="divide-y">
          {data?.items.slice(0, 8).map((item) => (
            <li key={item.newsItemId} className="flex items-start justify-between gap-3 py-2.5">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 text-sm leading-snug hover:text-primary"
              >
                {item.title}
                <span className="ml-2 text-xs text-muted-foreground">({item.source})</span>
              </a>
              <button
                type="button"
                aria-label={t('remove')}
                onClick={() => remove.mutate(item.newsItemId)}
                className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {data && data.items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </CardContent>
    </Card>
  )
}

type SavedReportsData = {
  items: { reportId: string; title: string; savedAt: string }[]
}

export function SavedReportsCard() {
  const t = useTranslations('dashboard.savedReports')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'saved-reports'],
    queryFn: () => getJson<SavedReportsData>('/api/me/saved-reports'),
  })

  const remove = useMutation({
    mutationFn: (reportId: string) =>
      fetch(`/api/me/saved-reports/${reportId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'saved-reports'] }),
  })

  return (
    <Card data-testid="saved-reports-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bookmark className="h-5 w-5 text-primary" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-20 w-full" />}
        <ul className="divide-y">
          {data?.items.slice(0, 8).map((item) => (
            <li key={item.reportId} className="flex items-start justify-between gap-3 py-2.5">
              <span className="min-w-0 text-sm leading-snug">{item.title}</span>
              <button
                type="button"
                aria-label={t('remove')}
                onClick={() => remove.mutate(item.reportId)}
                className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {data && data.items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </CardContent>
    </Card>
  )
}
