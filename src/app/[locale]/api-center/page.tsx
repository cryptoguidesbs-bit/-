import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { ApiCenter } from '@/components/api-center/api-center'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'apiCenter' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/api-center', locale),
  }
}

// Premium: the API Center requires the Whale plan (api.center) and is
// region-gated. API responses always carry the disclaimer/terms meta.
export default async function ApiCenterPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  const gate = await checkFeature('api.center')
  if (!gate.allowed) {
    return <UpgradeRequired gate={gate} />
  }

  const t = await getTranslations({ locale, namespace: 'apiCenter' })
  return (
    <div className="space-y-6 py-6" data-testid="api-center-page">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Usage terms — always visible */}
      <p
        data-testid="api-center-terms"
        className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-500"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {t('terms')}
      </p>

      <ApiCenter />
    </div>
  )
}
