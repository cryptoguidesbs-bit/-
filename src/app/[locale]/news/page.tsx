import type { Metadata } from 'next'
import { TrackView } from '@/components/analytics/track-view'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { NewsExplorer } from '@/components/news/news-explorer'
import { pageAlternates } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'news' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/news', locale),
  }
}

export default async function NewsPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'news' })

  return (
    <div className="space-y-6 py-6" data-testid="news-page">
      <TrackView name="news_view" />
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <NewsExplorer />
    </div>
  )
}
