import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { PagePlaceholder } from '@/components/page-placeholder'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'pages.portfolio' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: pageAlternates('/portfolio', locale),
  }
}

export default async function PortfolioPage({ params: { locale } }: Props) {
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'pages.portfolio' })

  return <PagePlaceholder title={t('title')} description={t('description')} />
}
