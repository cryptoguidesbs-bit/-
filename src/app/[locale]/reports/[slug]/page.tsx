import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Sparkles } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { SaveReportButton } from '@/components/reports/save-report-button'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { Link } from '@/i18n/navigation'

type Props = { params: { locale: string; slug: string } }

export async function generateMetadata({ params: { locale, slug } }: Props): Promise<Metadata> {
  const report = await prisma.report.findUnique({
    where: { slug_locale: { slug, locale: locale === 'ko' ? 'ko' : 'en' } },
    select: { title: true, summary: true, status: true },
  })
  if (!report || report.status !== 'PUBLISHED') return {}
  return { title: report.title, description: report.summary ?? undefined }
}

// Minimal markdown rendering for our controlled report format
// (## headings, - bullets, paragraphs).
function RenderMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/)
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const lines = block.split('\n').filter((l) => l.trim().length > 0)
        if (lines.length === 0) return null
        if (lines[0].startsWith('## ')) {
          const [heading, ...rest] = lines
          return (
            <div key={index} className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {heading.replace(/^## /, '')}
              </h2>
              {rest.length > 0 && <BlockLines lines={rest} />}
            </div>
          )
        }
        return <BlockLines key={index} lines={lines} />
      })}
    </div>
  )
}

function BlockLines({ lines }: { lines: string[] }) {
  const bullets = lines.filter((l) => l.startsWith('- '))
  const text = lines.filter((l) => !l.startsWith('- '))
  return (
    <>
      {text.length > 0 && (
        <p className="text-sm leading-relaxed text-muted-foreground">{text.join(' ')}</p>
      )}
      {bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          {bullets.map((b, i) => (
            <li key={i}>{b.replace(/^- /, '')}</li>
          ))}
        </ul>
      )}
    </>
  )
}

export default async function ReportDetailPage({ params: { locale, slug } }: Props) {
  setRequestLocale(locale)

  const gate = await checkFeature('reports.premium')
  if (!gate.allowed) {
    return <UpgradeRequired gate={gate} />
  }

  const t = await getTranslations({ locale, namespace: 'reports' })
  const report = await prisma.report.findUnique({
    where: { slug_locale: { slug, locale: locale === 'ko' ? 'ko' : 'en' } },
  })
  if (!report || report.status !== 'PUBLISHED') notFound()

  const dateFormat = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  })

  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 py-6" data-testid="report-detail">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{t(`cadence.${report.cadence}`)}</Badge>
          <Badge variant="outline">{t(`category.${report.category}`)}</Badge>
          <span className="text-muted-foreground">{report.periodKey}</span>
          {report.publishedAt && (
            <span className="text-muted-foreground">{dateFormat.format(report.publishedAt)}</span>
          )}
          <span className="flex items-center gap-1 text-primary">
            <Sparkles className="h-3 w-3" />
            {t('aiLabel', { model: report.aiModel ?? 'AI' })}
          </span>
          <span className="text-muted-foreground">· {t('nonPersonalized')}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{report.title}</h1>
          <SaveReportButton reportId={report.id} />
        </div>
        {report.summary && (
          <p className="text-base leading-relaxed text-muted-foreground">{report.summary}</p>
        )}
      </div>

      <p
        data-testid="report-disclaimer"
        className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-500"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {t('disclaimer')}
      </p>

      <RenderMarkdown content={report.content} />
    </article>
  )
}
