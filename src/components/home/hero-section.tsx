import { Activity, Bell, FileText, Newspaper, Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

// Home hero — the one-subscription value proposition up top. The primary CTA
// goes straight to sign-up; the secondary one proves the product with the
// public daily brief. The Crypto Map lives further down as a bonus section.
export async function HeroSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home.hero' })

  const chips = [
    { icon: Activity, label: t('chips.c1') },
    { icon: Newspaper, label: t('chips.c2') },
    { icon: FileText, label: t('chips.c3') },
    { icon: Bell, label: t('chips.c4') },
  ]

  return (
    <section className="py-14 md:py-20" data-testid="home-hero">
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {t('badge')}
        </Badge>
        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          {t('title')}{' '}
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            {t('titleHighlight')}
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
          {t('subtitle')}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/sign-up">{t('ctaPrimary')}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/brief">{t('ctaSecondary')}</Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {chips.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              {label}
            </span>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground" data-testid="home-hero-disclaimer">
          {t('disclaimer')}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground" data-testid="home-hero-trust">
          {t('trust')}{' '}
          <Link href="/data" className="font-medium text-primary hover:underline">
            {t('trustLink')}
          </Link>
        </p>
      </div>
    </section>
  )
}
