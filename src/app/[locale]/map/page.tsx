import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getDbUser } from '@/lib/user'
import { MapApp } from '@/components/map/map-app'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'map' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/map', locale),
    // Login-only page — keep it out of search indexes.
    robots: { index: false },
  }
}

// Crypto Map — login required (middleware protects the route); all plans
// free, so NO plan gate. Informational only; not transaction brokering.
export default async function MapPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  // Belt & suspenders: middleware already redirects, but re-verify.
  const user = await getDbUser()
  if (!user) redirect(`/${locale}/sign-in`)

  const t = await getTranslations({ locale, namespace: 'map' })

  return (
    <div className="space-y-4 py-6" data-testid="map-page">
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
