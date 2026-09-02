import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { DataMethodology } from '@/components/data/data-methodology'
import { pageMeta } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params

  const t = await getTranslations({ locale, namespace: 'data' })
  return pageMeta({
    locale,
    path: '/data',
    title: t('title'),
    description: t('subtitle'),
  })
}

// Public transparency page: sources, refresh cadences, AI rules, limits,
// retention, corrections contact.
export default async function DataPage(props: Props) {
  const { locale } = await props.params

  setRequestLocale(locale)
  return <DataMethodology locale={locale} />
}
