import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { RefundPolicy } from '@/components/legal/refund-policy'
import { isLegalSlug, legalSlugs } from '@/config/legal'
import { Link } from '@/i18n/navigation'
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

// 'refund' is published; the others are placeholders until stage 22.
export default async function LegalPage({ params: { locale, slug } }: Props) {
  if (!isLegalSlug(slug)) notFound()
  setRequestLocale(locale)

  if (slug === 'refund') {
    return <RefundPolicy locale={locale} />
  }

  const t = await getTranslations({ locale, namespace: `legal.${slug}` })
  const tLegal = await getTranslations({ locale, namespace: 'legal' })
  const tRefund = await getTranslations({ locale, namespace: 'legal.refund' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  return (
    <article className="flex flex-col items-start gap-4 py-10">
      <Badge variant="secondary">{tCommon('comingSoon')}</Badge>
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="max-w-prose text-muted-foreground">{tLegal('placeholder')}</p>

      {/* The Terms reference the (published) Refund Policy. */}
      {slug === 'terms' && (
        <div
          className="mt-4 space-y-2 rounded-lg border p-4"
          data-testid="terms-refund-reference"
        >
          <p className="text-sm font-medium">{tLegal('relatedTitle')}</p>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {t('refundReference')}
          </p>
          <Link
            href="/legal/refund"
            className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {tRefund('title')}
          </Link>
        </div>
      )}
    </article>
  )
}
