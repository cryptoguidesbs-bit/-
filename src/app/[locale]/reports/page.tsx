import type { Metadata } from 'next'
import { AlertTriangle, FileText, Sparkles } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Prisma, ReportCadence, ReportCategory } from '@prisma/client'

import { checkFeature } from '@/lib/entitlements'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { Link } from '@/i18n/navigation'
import { pageAlternates } from '@/lib/seo'
import { cn } from '@/lib/utils'

type Props = {
  params: { locale: string }
  searchParams: { cadence?: string; category?: string }
}

const CADENCES = ['WEEKLY', 'MONTHLY', 'QUARTERLY'] as const
const CATEGORIES = ['ETF', 'MACRO', 'ONCHAIN'] as const

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'reports' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/reports', locale),
  }
}

// Premium research (Pro+, reports.premium). Non-personalized.
export default async function ReportsPage({ params: { locale }, searchParams }: Props) {
  setRequestLocale(locale)

  const gate = await checkFeature('reports.premium')
  if (!gate.allowed) {
    return <UpgradeRequired gate={gate} />
  }

  const t = await getTranslations({ locale, namespace: 'reports' })
  const cadence = (searchParams.cadence ?? '').toUpperCase()
  const category = (searchParams.category ?? '').toUpperCase()

  const where: Prisma.ReportWhereInput = {
    status: 'PUBLISHED',
    locale: locale === 'ko' ? 'ko' : 'en',
    category: { not: null },
  }
  if ((CADENCES as readonly string[]).includes(cadence)) where.cadence = cadence as ReportCadence
  if ((CATEGORIES as readonly string[]).includes(category))
    where.category = category as ReportCategory

  const reports = await prisma.report.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: 30,
  })

  const filterHref = (key: 'cadence' | 'category', value: string) => {
    const params = new URLSearchParams()
    if (key === 'cadence' ? value : cadence) params.set('cadence', key === 'cadence' ? value : cadence)
    if (key === 'category' ? value : category)
      params.set('category', key === 'category' ? value : category)
    const qs = params.toString()
    return `/reports${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6 py-6" data-testid="reports-page">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <p
        data-testid="reports-disclaimer"
        className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-500"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {t('disclaimer')}
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip href={filterHref('cadence', '')} active={!cadence} label={t('all')} />
        {CADENCES.map((value) => (
          <FilterChip
            key={value}
            href={filterHref('cadence', value)}
            active={cadence === value}
            label={t(`cadence.${value}`)}
          />
        ))}
        <span className="mx-1 text-muted-foreground">·</span>
        <FilterChip href={filterHref('category', '')} active={!category} label={t('all')} />
        {CATEGORIES.map((value) => (
          <FilterChip
            key={value}
            href={filterHref('category', value)}
            active={category === value}
            label={t(`category.${value}`)}
          />
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {reports.map((report) => (
          <Card key={report.id} className="transition-colors hover:border-primary/40">
            <CardContent className="p-4">
              <Link href={`/reports/${report.slug}`} className="block space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{t(`cadence.${report.cadence}`)}</Badge>
                  <Badge variant="outline">{t(`category.${report.category}`)}</Badge>
                  <span className="text-muted-foreground">{report.periodKey}</span>
                  <span className="flex items-center gap-1 text-primary">
                    <Sparkles className="h-3 w-3" />
                    {t('aiLabel', { model: report.aiModel ?? 'AI' })}
                  </span>
                </div>
                <p className="flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  {report.title}
                </p>
                {report.summary && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
                )}
              </Link>
            </CardContent>
          </Card>
        ))}
        {reports.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </div>
    </div>
  )
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {label}
    </Link>
  )
}
