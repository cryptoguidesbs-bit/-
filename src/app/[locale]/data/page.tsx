import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { DataMethodology } from '@/components/data/data-methodology'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'data' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/data', locale),
  }
}

// Public transparency page: sources, refresh cadences, AI rules, limits,
// retention, corrections contact.
export default function DataPage({ params: { locale } }: Props) {
  setRequestLocale(locale)
  return <DataMethodology locale={locale} />
}
