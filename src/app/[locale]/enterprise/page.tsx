import type { Metadata } from 'next'
import {
  Briefcase,
  Building2,
  Check,
  Landmark,
  Newspaper,
  Rocket,
  Scale,
} from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ENTERPRISE_FROM_MONTHLY } from '@/config/pricing'
import { EnterpriseCta } from '@/components/enterprise/enterprise-cta'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import { pageMeta } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const TARGETS = [
  { key: 'funds', icon: Briefcase },
  { key: 'exchanges', icon: Building2 },
  { key: 'finance', icon: Landmark },
  { key: 'web3', icon: Rocket },
  { key: 'media', icon: Newspaper },
  { key: 'legal', icon: Scale },
] as const

// The pricing card promises 14 Enterprise features (home.pricing.tiers
// .enterprise.f1..f14); this page lists the same strings so the two can
// never drift apart.
const ENTERPRISE_FEATURE_COUNT = 14

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'enterprise' })
  return pageMeta({
    locale,
    path: '/enterprise',
    title: t('metaTitle'),
    description: t('metaDescription'),
  })
}

export default async function EnterprisePage(props: Props) {
  const { locale } = await props.params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'enterprise' })
  const tTiers = await getTranslations({ locale, namespace: 'home.pricing.tiers.enterprise' })

  return (
    <div className="pb-16">
      {/* Hero */}
      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary">{t('badge')}</Badge>
          <h1 className="mt-4 text-balance break-keep text-4xl font-bold tracking-tight md:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
            {t('subtitle')}
          </p>
          <p className="mt-3 text-sm font-medium text-primary">
            {t('fromPrice', { price: usd.format(ENTERPRISE_FROM_MONTHLY) })}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <EnterpriseCta label={t('ctaContact')} />
            <Button size="lg" variant="outline" asChild>
              <Link href="/#pricing">{t('ctaPricing')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Targets */}
      <section className="py-10" data-testid="enterprise-targets">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('targetsTitle')}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t('targetsSubtitle')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TARGETS.map(({ key, icon: Icon }) => (
            <Card key={key} className="h-full">
              <CardContent className="space-y-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold">{t(`targets.${key}.name`)}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`targets.${key}.use`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features — same strings as the pricing card */}
      <section className="py-10" data-testid="enterprise-features">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('featuresTitle')}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t('featuresSubtitle')}</p>
        <ul className="mt-8 grid gap-x-8 gap-y-3 rounded-xl border bg-card p-6 sm:grid-cols-2 md:p-8">
          {Array.from({ length: ENTERPRISE_FEATURE_COUNT }, (_, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{tTiers(`f${i + 1}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Cooperation models */}
      <section className="py-10" data-testid="enterprise-coop">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('coopTitle')}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(['data', 'content', 'poc'] as const).map((key) => (
            <Card key={key} className="h-full">
              <CardContent className="space-y-2 p-5">
                <p className="font-semibold">{t(`coop.${key}.title`)}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`coop.${key}.desc`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-10">
        <div className="rounded-xl border bg-card p-8 text-center md:p-12">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('bottomTitle')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t('bottomSubtitle')}</p>
          <div className="mt-6 flex justify-center">
            <EnterpriseCta label={t('ctaContact')} />
          </div>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          {t('disclaimer')}
        </p>
      </section>
    </div>
  )
}
