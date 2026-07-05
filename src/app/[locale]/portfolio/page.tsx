import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { PortfolioAnalytics } from '@/components/portfolio/portfolio-analytics'
import { PortfolioManager } from '@/components/portfolio/portfolio-manager'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
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

// Premium: portfolio tools require the Professional plan.
export default async function PortfolioPage({ params: { locale } }: Props) {
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
