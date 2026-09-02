import type { Metadata } from 'next'
import { ListFilter } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { TrackView } from '@/components/analytics/track-view'
import { CoinScreener } from '@/components/screener/coin-screener'
import { pageMeta } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'screener' })
  return pageMeta({ locale, path: '/screener', title: t('metaTitle'), description: t('subtitle') })
}

// Coin Screener — public. Top-100 by market cap with sortable market data;
// plain numbers, no derived signals.
export default async function ScreenerPage(props: Props) {
  const { locale } = await props.params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'screener' })

  return (
    <div className="space-y-6 py-6" data-testid="screener-page">
      <TrackView name="screener_view" />
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <ListFilter className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CoinScreener />
    </div>
  )
}
