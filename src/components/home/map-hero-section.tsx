import { MapPin } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapApp } from '@/components/map/map-app'
import { Link } from '@/i18n/navigation'

// Home page hero = the Crypto Map itself (public, no login). A compact
// headline row keeps the brand message and CTAs; the interactive map is the
// main view. Server component shell; MapApp is the client island.
export async function MapHeroSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home.hero' })
  const tMap = await getTranslations({ locale, namespace: 'map' })

  return (
    <section className="mt-4" data-testid="map-hero">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {tMap('title')}
          </Badge>
          <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            {t('title')}{' '}
            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              {t('titleHighlight')}
            </span>
          </h1>
          <p className="max-w-2xl text-balance text-muted-foreground">{tMap('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <a href="#pricing">{t('ctaPrimary')}</a>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/map">{tMap('openFull')}</Link>
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <MapApp locale={locale} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground" data-testid="map-hero-disclaimer">
        {tMap('disclaimer')} {t('disclaimer')}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground" data-testid="map-hero-trust">
        {t('trust')}{' '}
        <Link href="/data" className="font-medium text-primary hover:underline">
          {t('trustLink')}
        </Link>
      </p>
    </section>
  )
}
