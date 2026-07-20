import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { OnchainDashboard } from '@/components/onchain/onchain-dashboard'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'onchain' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/onchain', locale),
  }
}

// Premium: whale & on-chain data requires the Pro plan
// (onchain.advanced — region policy also applies).
export default async function OnchainPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  const gate = await checkFeature('onchain.advanced')
  if (!gate.allowed) {
    return <UpgradeRequired gate={gate} />
  }

  const t = await getTranslations({ locale, namespace: 'onchain' })
  return (
    <div className="space-y-6 py-6" data-testid="onchain-page">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <OnchainDashboard />
    </div>
  )
}
