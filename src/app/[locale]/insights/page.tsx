import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { PagePlaceholder } from '@/components/page-placeholder'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'pages.insights' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: pageAlternates('/insights', locale),
    // Placeholder page (not launched) — keep it out of search indexes.
    robots: { index: false },
  }
}

export default async function InsightsPage({ params: { locale } }: Props) {
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'pages.insights' })

  return <PagePlaceholder title={t('title')} description={t('description')} />
}
