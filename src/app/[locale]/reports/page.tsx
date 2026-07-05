import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { PagePlaceholder } from '@/components/page-placeholder'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'pages.reports' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: pageAlternates('/reports', locale),
  }
}

// Premium: research reports require the Institutional plan.
export default async function ReportsPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  const gate = await checkFeature('reports.premium')
  if (!gate.allowed) {
    return <UpgradeRequired gate={gate} />
  }

  const t = await getTranslations({ locale, namespace: 'pages.reports' })
  return <PagePlaceholder title={t('title')} description={t('description')} />
}
