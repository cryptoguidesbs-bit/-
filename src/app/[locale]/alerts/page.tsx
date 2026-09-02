import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { AlertCenter } from '@/components/alerts/alert-center'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { pageMeta } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'alerts' })
  return pageMeta({
    locale,
    path: '/alerts',
    title: t('title'),
    description: t('subtitle'),
  })
}

// Premium: realtime alerts require the Trader plan (alerts.realtime).
// Alerts are event notifications only — never action directives.
export default async function AlertsPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  const gate = await checkFeature('alerts.realtime')
  if (!gate.allowed) {
    return <UpgradeRequired gate={gate} />
  }

  const t = await getTranslations({ locale, namespace: 'alerts' })
  return (
    <div className="space-y-6 py-6" data-testid="alerts-page">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Always-visible disclaimer */}
      <p
        data-testid="alerts-disclaimer"
        className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-500"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {t('disclaimer')}
      </p>

      <AlertCenter />
    </div>
  )
}
