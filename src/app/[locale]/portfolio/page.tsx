import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { PortfolioAnalytics } from '@/components/portfolio/portfolio-analytics'
import { PortfolioManager } from '@/components/portfolio/portfolio-manager'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { pageMeta } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params

  const t = await getTranslations({ locale, namespace: 'pages.portfolio' })
  return pageMeta({
    locale,
    path: '/portfolio',
    title: t('title'),
    description: t('description'),
  })
}

// Premium: portfolio tools require the Trader plan.
export default async function PortfolioPage(props: Props) {
  const { locale } = await props.params

  setRequestLocale(locale)

  const gate = await checkFeature('portfolio.tools')
  if (!gate.allowed) {
    return <UpgradeRequired gate={gate} />
  }

  const t = await getTranslations({ locale, namespace: 'dashboard.portfolio' })
  return (
    <div className="space-y-6 py-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <PortfolioAnalytics />
      <PortfolioManager />
    </div>
  )
}
