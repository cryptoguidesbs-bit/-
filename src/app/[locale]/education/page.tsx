import type { Metadata } from 'next'
import { Clock, GraduationCap, Lock } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import {
  EDUCATION_LEVELS,
  EDUCATION_TRACKS,
  lessons,
} from '@/config/education'
import { getAccessSnapshot } from '@/lib/education/access'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'education' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/education', locale),
  }
}

// Education hub — the full curriculum is visible to everyone; locked lessons
// carry sign-up / upgrade CTAs (conversion funnel).
export default async function EducationPage({ params: { locale } }: Props) {
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'education' })
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en'
  const access = await getAccessSnapshot()

  return (
    <div className="space-y-8 py-6" data-testid="education-page">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <GraduationCap className="h-8 w-8 text-primary" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {EDUCATION_TRACKS.map((track) => (
        <section key={track} className="space-y-3" data-testid={`track-${track}`}>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{t(`tracks.${track}.name`)}</h2>
            <p className="text-sm text-muted-foreground">{t(`tracks.${track}.description`)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {EDUCATION_LEVELS.map((level) => {
              const lesson = lessons.find((l) => l.track === track && l.level === level)
              if (!lesson) return null
              const unlocked = access[lesson.access]
              return (
                <Card
                  key={lesson.slug}
                  className="transition-colors hover:border-primary/40"
                  data-testid={unlocked ? 'lesson-open' : 'lesson-locked'}
                >
                  <CardContent className="p-4">
                    <Link href={`/education/${lesson.slug}`} className="block space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary">{t(`levels.${level}`)}</Badge>
                        <Badge
                          variant="outline"
                          className={unlocked ? 'text-emerald-500' : 'text-muted-foreground'}
                        >
                          {unlocked ? (
                            t(`access.${lesson.access}`)
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              {t(`access.${lesson.access}`)}
                            </span>
                          )}
                        </Badge>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {t('minutes', { count: lesson.minutes })}
                        </span>
                      </div>
                      <p className="font-semibold leading-snug">{lesson.title[lang]}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {lesson.summary[lang]}
                      </p>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground">{t('note')}</p>
    </div>
  )
}
