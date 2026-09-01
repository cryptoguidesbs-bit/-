import { MapPin } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapApp } from '@/components/map/map-app'
import { Link } from '@/i18n/navigation'

// The Crypto Map as a bonus section near the end of the page — still fully
// interactive and public, but no longer the headline: the subscription value
// proposition owns the hero. Server component shell; MapApp is the client
// island.
export async function MapBonusSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home.mapBonus' })
  const tMap = await getTranslations({ locale, namespace: 'map' })

  return (
    <section id="map" className="scroll-mt-20 py-14 md:py-20 lg:scroll-mt-28" data-testid="map-bonus">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {t('badge')}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('title')}</h2>
          <p className="max-w-2xl text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/map">{tMap('openFull')}</Link>
        </Button>
      </div>

      <div className="mt-5">
        <MapApp locale={locale} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground" data-testid="map-bonus-disclaimer">
        {tMap('disclaimer')}
      </p>
    </section>
  )
}
