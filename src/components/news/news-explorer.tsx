'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Search, Sparkles } from 'lucide-react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------

type NewsApiItem = {
  id: string
  title: string
  url: string
  source: string
  region: 'US' | 'EUROPE' | 'ASIA' | 'GLOBAL'
  category: 'MARKET' | 'REGULATION' | 'TECHNOLOGY' | 'DEFI' | 'MACRO' | 'GENERAL'
  publishedAt: string
  aiStatus: 'PENDING' | 'PUBLISHED' | 'HELD'
  summaryKo: string | null
  summaryEn: string | null
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH' | null
  confidence: number | null
  aiModel: string | null
  aiGenerated: boolean
}

type NewsPage = { items: NewsApiItem[]; page: number; total: number; hasMore: boolean }

type MarketSentiment = {
  label: 'bullish' | 'neutral' | 'bearish'
  confidence: number
  sampleSize: number
  method: string
}

const CATEGORIES = ['MARKET', 'REGULATION', 'TECHNOLOGY', 'DEFI', 'MACRO', 'GENERAL'] as const
const REGIONS = ['US', 'EUROPE', 'ASIA'] as const

const SENTIMENT_STYLE: Record<string, string> = {
  bullish: 'text-emerald-500',
  neutral: 'text-yellow-500',
  bearish: 'text-red-500',
  BULLISH: 'bg-emerald-500/10 text-emerald-500',
  NEUTRAL: 'bg-yellow-500/10 text-yellow-500',
  BEARISH: 'bg-red-500/10 text-red-500',
}

// ---------------------------------------------------------------------------

function SentimentBanner() {
  const t = useTranslations('news')
  const { data, isLoading } = useQuery({
    queryKey: ['news-sentiment'],
    queryFn: async () => (await fetch('/api/news/sentiment')).json() as Promise<MarketSentiment>,
    refetchInterval: 5 * 60_000,
  })

  return (
    <Card data-testid="sentiment-banner">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{t('sentimentTitle')}</p>
          {isLoading && <Skeleton className="h-9 w-40" />}
          {data && (
            <p className={cn('text-3xl font-bold', SENTIMENT_STYLE[data.label])}>
              {t(`sentiment.${data.label}`)}
            </p>
          )}
        </div>
        <div className="space-y-1 text-right">
          {data && data.sampleSize > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('confidence')}:{' '}
              <span className="font-semibold text-foreground">{data.confidence}/100</span>
              {' · '}
              {t('sentimentMethod', { count: data.sampleSize })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t('sentimentDisclaimer')}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------

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

function ArticleCard({ item }: { item: NewsApiItem }) {
  const t = useTranslations('news')
  const locale = useLocale()
  const format = useFormatter()
  const summary = locale === 'ko' ? item.summaryKo : item.summaryEn

  return (
    <Card data-testid="news-article" className="transition-colors hover:border-primary/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="font-normal">
            {item.source}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            {t(`region.${item.region}`)}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            {t(`category.${item.category}`)}
          </Badge>
          <span className="text-muted-foreground">
            {format.relativeTime(new Date(item.publishedAt))}
          </span>
        </div>

        <a href={item.url} target="_blank" rel="noreferrer" className="group block">
          <p className="font-medium leading-snug group-hover:text-primary">
            {item.title}
            <ExternalLink className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
          </p>
        </a>

        {item.aiGenerated && summary && (
          <div className="space-y-2 rounded-lg bg-secondary/40 p-3" data-testid="ai-summary">
            <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                {t('aiLabel')}
              </span>
              {item.aiModel && (
                <span className="text-muted-foreground">({item.aiModel})</span>
              )}
              {item.sentiment && (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-medium',
                    SENTIMENT_STYLE[item.sentiment],
                  )}
                >
                  {t(`sentiment.${item.sentiment.toLowerCase()}`)}
                  {item.confidence !== null && ` ${item.confidence}`}
                </span>
              )}
            </div>
          </div>
        )}

        {item.aiStatus === 'PENDING' && (
          <p className="text-xs text-muted-foreground">{t('summaryPending')}</p>
        )}
        {item.aiStatus === 'HELD' && (
          <p className="text-xs text-muted-foreground" data-testid="summary-held">
            {t('summaryHeld')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------

export function NewsExplorer() {
  const t = useTranslations('news')
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [region, setRegion] = useState<string>('')

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 450)
    return () => clearTimeout(timer)
  }, [input])

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['news', query, category, region],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam) })
      if (query) params.set('query', query)
      if (category) params.set('category', category)
      if (region) params.set('region', region)
      const res = await fetch(`/api/news?${params.toString()}`)
      if (!res.ok) throw new Error('news fetch failed')
      return (await res.json()) as NewsPage
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    refetchInterval: 2 * 60_000,
  })

  const items = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="space-y-6">
      <SentimentBanner />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t('searchPlaceholder')}
          data-testid="news-search"
          className="w-full rounded-lg border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" data-testid="category-filters">
          <Chip active={category === ''} onClick={() => setCategory('')}>
            {t('categoryAll')}
          </Chip>
          {CATEGORIES.map((value) => (
            <Chip key={value} active={category === value} onClick={() => setCategory(value)}>
              {t(`category.${value}`)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" data-testid="region-filters">
          <Chip active={region === ''} onClick={() => setRegion('')}>
            {t('region.ALL')}
          </Chip>
          {REGIONS.map((value) => (
            <Chip key={value} active={region === value} onClick={() => setRegion(value)}>
              {t(`region.${value}`)}
            </Chip>
          ))}
        </div>
      </div>

      {/* Articles */}
      <div className="space-y-3">
        {isLoading &&
          Array.from({ length: 5 }, (_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}

        {items.map((item) => (
          <ArticleCard key={item.id} item={item} />
        ))}

        {!isLoading && items.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="news-empty">
            {t('empty')}
          </p>
        )}
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            data-testid="load-more"
          >
            {isFetchingNextPage ? t('loading') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
