import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

type Section = { heading: string; body: string }

// Published refund policy (real content, not a placeholder). Content and
// section order live in messages/*.json under `legal.refund`.
export async function RefundPolicy({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'legal.refund' })
  const sections = t.raw('sections') as Section[]

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 py-10" data-testid="refund-policy">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
        <p className="text-xs text-muted-foreground">{t('updated')}</p>
      </header>

      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>

      <div className="space-y-6">
        {sections.map((section, i) => (
          <section key={i} className="space-y-2" data-testid="refund-section">
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <div className="space-y-2 border-t pt-6">
        <h2 className="text-lg font-semibold tracking-tight">{t('howToTitle')}</h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{t('how')}</p>
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link href="/billing">
            {t('manageCta')}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <p className="max-w-prose border-t pt-6 text-xs leading-relaxed text-muted-foreground">
        {t('statutory')}
      </p>
    </article>
  )
}
