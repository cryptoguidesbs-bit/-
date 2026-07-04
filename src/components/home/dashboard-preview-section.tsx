'use client'

import { useTranslations } from 'next-intl'

import { Section } from '@/components/home/section'

// Decorative sparkline for the mock dashboard window — neutral shape, no
// figures attached.
const SPARKLINE = 'M0,60 C30,52 45,66 70,58 S110,40 140,46 S180,30 210,36 S250,20 280,26'

export function DashboardPreviewSection() {
  const t = useTranslations('home.preview')

  return (
    <Section id="preview" title={t('title')} subtitle={t('subtitle')}>
      <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-primary/5">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-500/60" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
          <span className="ml-3 rounded-md bg-secondary px-3 py-1 text-xs text-muted-foreground">
            app.cryptoguide.io/dashboard
          </span>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[1fr_280px] md:p-6">
          {/* Chart panel */}
          <div className="rounded-lg border bg-background/60 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">BTC/USDT</p>
                <p className="text-xs text-muted-foreground">{t('chartLabel')}</p>
              </div>
              <div className="flex gap-1">
                {['1H', '4H', '1D', '1W'].map((tf, i) => (
                  <span
                    key={tf}
                    className={
                      i === 2
                        ? 'rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary'
                        : 'rounded-md px-2 py-1 text-xs text-muted-foreground'
                    }
                  >
                    {tf}
                  </span>
                ))}
              </div>
            </div>
            <svg viewBox="0 0 280 80" className="h-40 w-full" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${SPARKLINE} L280,80 L0,80 Z`} fill="url(#spark-fill)" />
              <path d={SPARKLINE} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
            </svg>
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-3">
            {(['w1', 'w2', 'w3'] as const).map((key) => (
              <div key={key} className="rounded-lg border bg-background/60 p-4">
                <p className="text-sm font-medium">{t(`${key}.title`)}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t(`${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">{t('caption')}</p>
    </Section>
  )
}
