import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, GraduationCap, Lock, LogIn } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { pageAlternates } from '@/lib/seo'

import { getLesson } from '@/config/education'
import { checkLessonAccess, type LessonGate } from '@/lib/education/access'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'

type Props = { params: { locale: string; slug: string } }

export async function generateMetadata({ params: { locale, slug } }: Props): Promise<Metadata> {
  const lesson = getLesson(slug)
  if (!lesson) return {}
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en'
  return {
    title: lesson.title[lang],
    description: lesson.summary[lang],
    alternates: pageAlternates(`/education/${slug}`, locale),
  }
}

// Minimal markdown rendering (## headings + paragraphs) for lesson content.
function RenderLesson({ content }: { content: string }) {
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
              {rest.length > 0 && (
                <p className="text-sm leading-relaxed text-muted-foreground">{rest.join(' ')}</p>
              )}
            </div>
          )
        }
        return (
          <p key={index} className="text-sm leading-relaxed text-muted-foreground">
            {lines.join(' ')}
          </p>
        )
      })}
    </div>
  )
}

// Funnel gate: sign-in CTA for member lessons, upgrade CTA for standard.
function LessonGateCard({ gate, t }: { gate: LessonGate; t: (key: string) => string }) {
  const isAuth = gate.reason === 'auth'
  return (
    <div className="flex justify-center py-16" data-testid={`gate-${gate.reason}`}>
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            {isAuth ? (
              <LogIn className="h-6 w-6 text-muted-foreground" />
            ) : (
              <Lock className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <h1 className="text-xl font-semibold">
            {isAuth ? t('gateAuthTitle') : t('gatePlanTitle')}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isAuth ? t('gateAuthDescription') : t('gatePlanDescription')}
          </p>
          <Button asChild>
            <Link href={isAuth ? '/sign-up' : '/#pricing'}>
              {isAuth ? t('gateAuthCta') : t('gatePlanCta')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function LessonPage({ params: { locale, slug } }: Props) {
  setRequestLocale(locale)

  const lesson = getLesson(slug)
  if (!lesson) notFound()

  const t = await getTranslations({ locale, namespace: 'education' })
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en'
  const gate = await checkLessonAccess(lesson.access)

  if (!gate.allowed) {
    return <LessonGateCard gate={gate} t={t} />
  }

  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 py-6" data-testid="lesson-content">
      <Link
        href="/education"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToCurriculum')}
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{t(`tracks.${lesson.track}.name`)}</Badge>
          <Badge variant="outline">{t(`levels.${lesson.level}`)}</Badge>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t('minutes', { count: lesson.minutes })}
          </span>
        </div>
        <h1 className="flex items-start gap-2 text-3xl font-bold tracking-tight">
          <GraduationCap className="mt-1 h-7 w-7 shrink-0 text-primary" />
          {lesson.title[lang]}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">{lesson.summary[lang]}</p>
      </div>

      <RenderLesson content={lesson.content[lang]} />

      <p className="border-t pt-4 text-xs text-muted-foreground" data-testid="lesson-disclaimer">
        {t('note')}
      </p>
    </article>
  )
}
