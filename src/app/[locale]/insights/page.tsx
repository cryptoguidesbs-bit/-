import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { PagePlaceholder } from '@/components/page-placeholder'
import { pageMeta } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'pages.insights' })
  return {
    ...pageMeta({ locale, path: '/insights', title: t('title'), description: t('description') }),
    // Placeholder page (not launched) — keep it out of search indexes.
    robots: { index: false },
  }
}

export default async function InsightsPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'pages.insights' })

  return <PagePlaceholder title={t('title')} description={t('description')} />
}
