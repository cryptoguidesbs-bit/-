import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { isLegalSlug, legalSlugs } from '@/config/legal'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string; slug: string } }

export function generateStaticParams() {
  return legalSlugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params: { locale, slug } }: Props): Promise<Metadata> {
  if (!isLegalSlug(slug)) return {}
  const t = await getTranslations({ locale, namespace: `legal.${slug}` })
  return {
    title: t('title'),
    alternates: pageAlternates(`/legal/${slug}`, locale),
  }
}

// Placeholder until stage 22 (legal documents) delivers the real content.
export default async function LegalPage({ params: { locale, slug } }: Props) {
  if (!isLegalSlug(slug)) notFound()

  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: `legal.${slug}` })
  const tLegal = await getTranslations({ locale, namespace: 'legal' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  return (
    <article className="flex flex-col items-start gap-4 py-10">
      <Badge variant="secondary">{tCommon('comingSoon')}</Badge>
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="max-w-prose text-muted-foreground">{tLegal('placeholder')}</p>
    </article>
  )
}
