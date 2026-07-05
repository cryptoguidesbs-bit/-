import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { NewsExplorer } from '@/components/news/news-explorer'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'news' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/news', locale),
  }
}

export default async function NewsPage({ params: { locale } }: Props) {
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'news' })

  return (
    <div className="space-y-6 py-6" data-testid="news-page">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <NewsExplorer />
    </div>
  )
}
