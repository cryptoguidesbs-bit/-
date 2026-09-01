import type { Metadata } from 'next'
import { TrackView } from '@/components/analytics/track-view'
import { MapPin } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { MapApp } from '@/components/map/map-app'
import { pageAlternates } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'map' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/map', locale),
  }
}

// Crypto Map — PUBLIC (also the home page's main view); read APIs are IP
// rate-limited. Informational only; not transaction brokering.
export default async function MapPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'map' })

  return (
    <div className="space-y-4 py-6" data-testid="map-page">
      <TrackView name="map_view" />
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <MapPin className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Always-visible disclaimer — information only, not brokering. */}
      <p
        data-testid="map-disclaimer"
        className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-500"
      >
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        {t('disclaimer')}
      </p>

      <MapApp locale={locale} />
    </div>
  )
}
