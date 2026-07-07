import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

type Section = { heading: string; body: string }
type RegionNotice = { heading: string; body: string }
type Regions = { intro?: string; us: RegionNotice; eu: RegionNotice; kr: RegionNotice }

// Renders any published legal document from `legal.<slug>` translations.
// Optional blocks (regions / howTo + manageCta / statutory) render only when
// present, so one component serves Terms, Privacy, Disclaimer and Refund.
export async function LegalDocument({ locale, slug }: { locale: string; slug: string }) {
  const t = await getTranslations({ locale, namespace: `legal.${slug}` })
  const tLegal = await getTranslations({ locale, namespace: 'legal' })
  const sections = t.raw('sections') as Section[]
  const regions = t.has('regions') ? (t.raw('regions') as Regions) : null

  return (
    <article
      className="mx-auto w-full max-w-3xl space-y-8 py-10"
      data-testid={`legal-${slug}`}
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
        <p className="text-xs text-muted-foreground">{t('updated')}</p>
      </header>

      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>

      <div className="space-y-6">
        {sections.map((section, i) => (
          <section key={i} className="space-y-2" data-testid="legal-section">
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      {regions && (
        <div className="space-y-4 border-t pt-6" data-testid="legal-regions">
          <h2 className="text-lg font-semibold tracking-tight">{tLegal('regionsTitle')}</h2>
          {regions.intro && (
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {regions.intro}
            </p>
          )}
          {(['us', 'eu', 'kr'] as const).map((key) => (
            <section key={key} className="space-y-1" data-testid={`legal-region-${key}`}>
              <h3 className="text-sm font-semibold">{regions[key].heading}</h3>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {regions[key].body}
              </p>
            </section>
          ))}
        </div>
      )}

      {t.has('howToTitle') && (
        <div className="space-y-2 border-t pt-6">
          <h2 className="text-lg font-semibold tracking-tight">{t('howToTitle')}</h2>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{t('how')}</p>
          {t.has('manageCta') && (
            <Button asChild variant="secondary" size="sm" className="mt-2">
              <Link href="/billing">
                {t('manageCta')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      )}

      {t.has('related') && (
        <div className="space-y-2 border-t pt-6" data-testid="legal-related">
          <h2 className="text-lg font-semibold tracking-tight">{tLegal('relatedTitle')}</h2>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{t('related')}</p>
          <Link
            href="/legal/refund"
            className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {tLegal('refund.title')}
          </Link>
        </div>
      )}

      {t.has('statutory') && (
        <p className="max-w-prose border-t pt-6 text-xs leading-relaxed text-muted-foreground">
          {t('statutory')}
        </p>
      )}
    </article>
  )
}
