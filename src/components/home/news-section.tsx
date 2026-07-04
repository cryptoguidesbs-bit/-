'use client'

import { ExternalLink } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Section } from '@/components/home/section'

type NewsItem = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: number | null
  sample?: boolean
}

export function NewsSection() {
  const t = useTranslations('home.news')
  const format = useFormatter()

  const { data, isLoading } = useQuery({
    queryKey: ['market-news'],
    queryFn: async () => {
      const res = await fetch('/api/market/news')
      if (!res.ok) throw new Error('News fetch failed')
      return (await res.json()) as { items: NewsItem[]; live: boolean }
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  })

  return (
    <Section id="news" title={t('title')} subtitle={t('subtitle')}>
      {data && !data.live && (
        <p className="mb-4 text-xs text-muted-foreground">{t('sampleNotice')}</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {isLoading &&
          Array.from({ length: 6 }, (_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}

        {data?.items.map((item) => (
          <Card key={item.id} className="transition-colors hover:border-primary/40">
            <CardContent className="p-4">
              <a
                href={item.url}
                target={item.sample ? undefined : '_blank'}
                rel="noreferrer"
                className="group block space-y-2"
              >
                <p className="text-sm font-medium leading-snug group-hover:text-primary">
                  {item.title}
                  {!item.sample && (
                    <ExternalLink className="ml-1.5 inline h-3 w-3 text-muted-foreground" />
                  )}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="font-normal">
                    {item.source}
                  </Badge>
                  {item.publishedAt && (
                    <span>{format.relativeTime(new Date(item.publishedAt))}</span>
                  )}
                </div>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  )
}
