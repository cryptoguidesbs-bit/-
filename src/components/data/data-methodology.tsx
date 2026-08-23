import { getTranslations } from 'next-intl/server'

import { SUPPORT_EMAIL } from '@/config/contact'
import { Link } from '@/i18n/navigation'

type Item = { heading: string; body: string }
type Row = { what: string; cadence: string }

// Public "Data & methodology" page — written to match the code that runs
// (sources, cadences, AI rules, limitations, retention). Plain server
// component; copy lives in messages.data.*.
export async function DataMethodology({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'data' })
  const sources = t.raw('sources.items') as Item[]
  const rows = t.raw('cadence.rows') as Row[]
  const rules = t.raw('ai.rules') as string[]
  const limitations = t.raw('limitations.items') as Item[]
  const mapItems = t.raw('map.items') as string[]
  const retention = t.raw('retention.items') as Item[]
  const notStored = t.raw('retention.notStored') as string[]

  const h2 = 'text-lg font-semibold tracking-tight'
  const body = 'max-w-prose text-sm leading-relaxed text-muted-foreground'

  return (
    <article className="mx-auto w-full max-w-3xl space-y-10 py-10" data-testid="data-page">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
        <p className="text-xs text-muted-foreground">{t('updated')}</p>
      </header>

      <p className={body}>{t('intro')}</p>

      <section id="sources" className="space-y-4" data-testid="data-sources">
        <h2 className={h2}>{t('sources.title')}</h2>
        <p className={body}>{t('sources.intro')}</p>
        {sources.map((s, i) => (
          <div key={i} className="space-y-1">
            <h3 className="text-sm font-semibold">{s.heading}</h3>
            <p className={body}>{s.body}</p>
          </div>
        ))}
      </section>

      <section id="cadence" className="space-y-3" data-testid="data-cadence">
        <h2 className={h2}>{t('cadence.title')}</h2>
        <p className={body}>{t('cadence.intro')}</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b bg-card/50 text-left">
                <th className="px-3 py-2 font-medium">{t('cadence.columns.what')}</th>
                <th className="px-3 py-2 font-medium">{t('cadence.columns.cadence')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2">{r.what}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.cadence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="resilience" className="space-y-2">
        <h2 className={h2}>{t('resilience.title')}</h2>
        <p className={body}>{t('resilience.body')}</p>
      </section>

      <section id="ai" className="space-y-3" data-testid="data-ai">
        <h2 className={h2}>{t('ai.title')}</h2>
        <p className={body}>{t('ai.intro')}</p>
        <h3 className="text-sm font-semibold">{t('ai.rulesTitle')}</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <h3 className="text-sm font-semibold">{t('ai.checksTitle')}</h3>
        <p className={body}>{t('ai.checks')}</p>
        <h3 className="text-sm font-semibold">{t('ai.fallbackTitle')}</h3>
        <p className={body}>{t('ai.fallback')}</p>
        <p className={body}>{t('ai.notAdvice')}</p>
      </section>

      <section id="limitations" className="space-y-4" data-testid="data-limitations">
        <h2 className={h2}>{t('limitations.title')}</h2>
        {limitations.map((s, i) => (
          <div key={i} className="space-y-1">
            <h3 className="text-sm font-semibold">{s.heading}</h3>
            <p className={body}>{s.body}</p>
          </div>
        ))}
      </section>

      <section id="map" className="space-y-2">
        <h2 className={h2}>{t('map.title')}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {mapItems.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      <section id="retention" className="space-y-4" data-testid="data-retention">
        <h2 className={h2}>{t('retention.title')}</h2>
        <p className={body}>{t('retention.intro')}</p>
        {retention.map((s, i) => (
          <div key={i} className="space-y-1">
            <h3 className="text-sm font-semibold">{s.heading}</h3>
            <p className={body}>{s.body}</p>
          </div>
        ))}
        <h3 className="text-sm font-semibold">{t('retention.notStoredTitle')}</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {notStored.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <p className={body}>{t('retention.controls')}</p>
      </section>

      <section id="corrections" className="space-y-2 border-t pt-6" data-testid="data-corrections">
        <h2 className={h2}>{t('corrections.title')}</h2>
        <p className={body}>{t('corrections.body')}</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm font-medium text-primary hover:underline">
          {t('corrections.cta', { email: SUPPORT_EMAIL })}
        </a>
        <p className="text-xs text-muted-foreground">{t('corrections.mapTip')}</p>
      </section>

      <section className="space-y-2 border-t pt-6">
        <h2 className={h2}>{t('related.title')}</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <li><Link href="/legal/disclaimer" className="text-primary hover:underline">{t('related.disclaimer')}</Link></li>
          <li><Link href="/legal/privacy" className="text-primary hover:underline">{t('related.privacy')}</Link></li>
          <li><Link href="/legal/terms" className="text-primary hover:underline">{t('related.terms')}</Link></li>
          <li><Link href="/api-center" className="text-primary hover:underline">{t('related.apiCenter')}</Link></li>
        </ul>
      </section>
    </article>
  )
}
