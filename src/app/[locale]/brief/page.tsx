import type { Metadata } from 'next'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { prisma } from '@/lib/prisma'
import type { BriefSections } from '@/lib/brief/guidelines'
import { BRIEF_SECTION_KEYS } from '@/lib/brief/guidelines'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { Link } from '@/i18n/navigation'
import { pageAlternates } from '@/lib/seo'

type Props = {
  params: { locale: string }
  searchParams: { tier?: string }
}

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'brief' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/brief', locale),
  }
}

function Disclaimer({ text }: { text: string }) {
  return (
    <p
      data-testid="brief-disclaimer"
      className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-500"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </p>
  )
}

export default async function BriefPage({ params: { locale }, searchParams }: Props) {
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'brief' })
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en'

  const [daily, detailed] = await Promise.all([
    checkFeature('brief.daily'),
    checkFeature('brief.detailed'),
  ])

  const tier = detailed.allowed && searchParams.tier !== 'standard' ? 'DETAILED' : 'STANDARD'
  const brief = await prisma.marketBrief.findFirst({
    where: { tier, status: 'PUBLISHED' },
    orderBy: { briefDate: 'desc' },
  })
  const sections = brief ? (brief.sections as unknown as BriefSections) : null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6" data-testid="brief-page">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Always-visible disclaimer */}
      <Disclaimer text={t('disclaimer')} />

      {!brief || !sections ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('notPublished')}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{brief.briefDate}</Badge>
            <Badge variant="outline">
              {tier === 'DETAILED' ? t('tierDetailed') : t('tierStandard')}
            </Badge>
            <span className="flex items-center gap-1 text-xs">
              <Sparkles className="h-3 w-3 text-primary" />
              {t('aiLabel', { model: brief.aiModel })}
            </span>
            <span className="text-xs">· {t('nonPersonalized')}</span>
          </div>

          {/* Tier switch for Trader+ */}
          {daily.allowed && detailed.allowed && (
            <div className="flex gap-2">
              <Button variant={tier === 'DETAILED' ? 'default' : 'outline'} size="sm" asChild>
                <Link href="/brief">{t('tierDetailed')}</Link>
              </Button>
              <Button variant={tier === 'STANDARD' ? 'default' : 'outline'} size="sm" asChild>
                <Link href="/brief?tier=standard">{t('tierStandard')}</Link>
              </Button>
            </div>
          )}

          {daily.allowed ? (
            <div className="space-y-4">
              {BRIEF_SECTION_KEYS.map((key) => (
                <Card key={key} data-testid={`brief-section-${key}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{t(`sections.${key}`)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {sections[key]?.[lang]}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* FREE teaser: today's synthesis only */}
              <Card data-testid="brief-section-today">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{t('sections.today')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {sections.today?.[lang]}
                  </p>
                </CardContent>
              </Card>
              <UpgradeRequired gate={daily} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
