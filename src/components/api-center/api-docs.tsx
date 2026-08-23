'use client'

import { BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { API_SAMPLES, type ApiSampleKey } from './api-docs-samples'

const ENDPOINTS: { key: ApiSampleKey; path: string }[] = [
  { key: 'prices', path: '/api/v1/market/prices' },
  { key: 'sentiment', path: '/api/v1/market/sentiment' },
  { key: 'briefs', path: '/api/v1/briefs/latest' },
]

type Field = { name: string; desc: string }
type ErrorRow = { status: string; error: string; meaning: string; action: string }

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">
      <code>{children}</code>
    </pre>
  )
}

// API Center documentation: auth, response envelope, per-endpoint sample
// request/response + field table, rate limit & quota, error table, meta,
// webhooks, versioning. Copy in messages apiCenter.docs.*; samples are
// language-neutral (api-docs-samples.ts).
export function ApiDocs() {
  const tApi = useTranslations('apiCenter')
  const t = useTranslations('apiCenter.docs')
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cryptoguide.live'
  const errorRows = t.raw('errors.rows') as ErrorRow[]

  return (
    <Card data-testid="api-docs-card" className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" /> {tApi('docsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <p className="text-muted-foreground">{t('intro')}</p>
        <p className="text-xs text-muted-foreground">
          {t('baseUrl')}: <code className="rounded bg-background/60 px-1.5 py-0.5">{origin}</code>
        </p>

        <section className="space-y-2">
          <h3 className="font-semibold">{t('auth.title')}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('auth.body')}</p>
          <Code>{API_SAMPLES.prices.curl(origin)}</Code>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">{t('envelope.title')}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('envelope.body')}</p>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">{t('endpoints.title')}</h3>
          {ENDPOINTS.map((e) => {
            const fields = t.raw(`endpoints.${e.key}.fields`) as Field[]
            const sample = API_SAMPLES[e.key]
            return (
              <details
                key={e.key}
                open={e.key === 'prices'}
                className="rounded-lg border p-3"
                data-testid="api-doc-row"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="text-xs">{e.path}</code>
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t(`endpoints.${e.key}.summary`)}
                  </p>
                  <p className="text-xs font-medium">{t('endpoints.request')}</p>
                  <Code>{sample.curl(origin)}</Code>
                  <p className="text-xs font-medium">{t('endpoints.response')}</p>
                  <Code>{sample.response}</Code>
                  <p className="text-xs font-medium">{t('endpoints.fields')}</p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[360px] text-xs">
                      <tbody>
                        {fields.map((f) => (
                          <tr key={f.name} className="border-b last:border-0 align-top">
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono">{f.name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{f.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            )
          })}
        </section>

        <section className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <h3 className="font-semibold">{t('limits.title')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>{t('limits.perMinute')}</li>
            <li>{t('limits.perMonth')}</li>
            <li>{t('limits.headers')}</li>
            <li>{t('limits.advice')}</li>
          </ul>
          <Code>{API_SAMPLES.error429}</Code>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">{t('errors.title')}</h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b bg-card/50 text-left">
                  <th className="px-3 py-1.5 font-medium">{t('errors.columns.status')}</th>
                  <th className="px-3 py-1.5 font-medium">{t('errors.columns.error')}</th>
                  <th className="px-3 py-1.5 font-medium">{t('errors.columns.meaning')}</th>
                  <th className="px-3 py-1.5 font-medium">{t('errors.columns.action')}</th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0 align-top">
                    <td className="px-3 py-1.5 font-mono">{r.status}</td>
                    <td className="px-3 py-1.5 font-mono">{r.error}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.meaning}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('errors.shape')}</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">{t('meta.title')}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('meta.body')}</p>
          <Code>{API_SAMPLES.meta}</Code>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">{t('webhooks.title')}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('webhooks.body')}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('webhooks.events')}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('webhooks.headers')}</p>
          <Code>{API_SAMPLES.webhookDelivery}</Code>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('webhooks.verify')}</p>
          <Code>{API_SAMPLES.webhookVerifyNode}</Code>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">{t('versioning.title')}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('versioning.body')}</p>
        </section>
      </CardContent>
    </Card>
  )
}
