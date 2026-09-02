import type { Metadata } from 'next'
import { Gauge } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { TrackView } from '@/components/analytics/track-view'
import { MarketScorePanel } from '@/components/score/market-score-panel'
import { pageMeta } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'score' })
  return pageMeta({ locale, path: '/score', title: t('metaTitle'), description: t('subtitle') })
}

// Market Score — public. A descriptive market-condition gauge with its full
// input breakdown; the methodology lives on /data#score.
export default async function ScorePage(props: Props) {
  const { locale } = await props.params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'score' })

  return (
    <div className="space-y-6 py-6" data-testid="score-page">
      <TrackView name="score_view" />
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Gauge className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <MarketScorePanel />
    </div>
  )
}
