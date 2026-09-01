import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { DataMethodology } from '@/components/data/data-methodology'
import { pageAlternates } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'data' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/data', locale),
  }
}

// Public transparency page: sources, refresh cadences, AI rules, limits,
// retention, corrections contact.
export default async function DataPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)
  return <DataMethodology locale={locale} />
}
