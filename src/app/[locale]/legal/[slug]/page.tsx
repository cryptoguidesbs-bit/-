import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { LegalDocument } from '@/components/legal/legal-document'
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
    description: t('subtitle'),
    alternates: pageAlternates(`/legal/${slug}`, locale),
  }
}

// All four documents (terms / privacy / disclaimer / refund) are published
// and rendered from their `legal.<slug>` translations. Automatic ko/en via
// next-intl. NOTE: these are review-ready drafts; production launch is gated
// on the attorney review tracked in docs/legal-review.md.
export default async function LegalPage({ params: { locale, slug } }: Props) {
  if (!isLegalSlug(slug)) notFound()
  setRequestLocale(locale)
  return <LegalDocument locale={locale} slug={slug} />
}
