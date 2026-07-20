'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useLocale, useTranslations } from 'next-intl'

import { pricingTiers, tierAmount, type PricingTierKey } from '@/config/pricing'
import type { BillingInterval } from '@/lib/payments/plans'
import { useRouter } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Section } from '@/components/home/section'
import { Reveal } from '@/components/home/reveal'
import { cn } from '@/lib/utils'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function PricingSection() {
  const t = useTranslations('home.pricing')
  const locale = useLocale()
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loadingTier, setLoadingTier] = useState<PricingTierKey | null>(null)
  const [checkoutError, setCheckoutError] = useState(false)

  const startCheckout = async (tier: PricingTierKey) => {
    setCheckoutError(false)

    if (tier === 'free' || !isSignedIn) {
      router.push('/sign-up')
      return
    }

    setLoadingTier(tier)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: tier, interval, locale }),
      })
      if (res.status === 401) {
        router.push('/sign-in')
        return
      }
      if (res.status === 409) {
        router.push('/billing')
        return
      }
      if (!res.ok) throw new Error('checkout failed')
      const { url } = (await res.json()) as { url: string }
      window.location.href = url
    } catch {
      setCheckoutError(true)
      setLoadingTier(null)
    }
  }

  return (
    <Section id="pricing" title={t('title')} subtitle={t('subtitle')}>
      {/* Monthly / yearly toggle — yearly carries the "2 months free" badge. */}
      <div className="mb-8 flex items-center justify-center gap-1 rounded-lg border bg-card p-1 md:w-fit">
        {(['monthly', 'yearly'] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setInterval(i)}
            aria-pressed={interval === i}
            data-testid={`interval-${i}`}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              interval === i
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(i === 'monthly' ? 'intervalMonthly' : 'intervalYearly')}
            {i === 'yearly' && (
              <Badge variant="outline" className="text-emerald-500">
                {t('yearlySave')}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {pricingTiers.map((tier, index) => (
          <Reveal key={tier.key} delay={index * 60}>
            <Card
              className={cn(
                'relative flex h-full flex-col',
                tier.popular && 'border-primary shadow-lg shadow-primary/10',
              )}
            >
              {tier.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">{t('popular')}</Badge>
              )}
              <CardHeader className="space-y-2 pb-4">
                <p className="font-semibold">{t(`tiers.${tier.key}.name`)}</p>

                {tier.key === 'free' ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums">{usd.format(0)}</span>
                  </div>
                ) : (
                  /* Both prices stay fully legible; the toggle highlights the
                     one that will be charged rather than dimming the other. */
                  <div className="space-y-1.5">
                    <div
                      className={cn(
                        'flex flex-wrap items-baseline gap-x-1.5 gap-y-1 rounded-lg px-2 py-1 transition-colors',
                        interval === 'monthly' && 'bg-muted ring-1 ring-border',
                      )}
                      data-testid={`price-monthly-${tier.key}`}
                    >
                      <span className="text-3xl font-bold tabular-nums">
                        {usd.format(tierAmount(tier.key, 'monthly'))}
                      </span>
                      <span className="text-sm text-muted-foreground">{t('perMonth')}</span>
                    </div>
                    <div
                      className={cn(
                        'flex flex-wrap items-baseline gap-x-1.5 gap-y-1 rounded-lg px-2 py-1 transition-colors',
                        interval === 'yearly' && 'bg-muted ring-1 ring-border',
                      )}
                      data-testid={`price-yearly-${tier.key}`}
                    >
                      <span className="text-2xl font-bold tabular-nums">
                        {usd.format(tierAmount(tier.key, 'yearly'))}
                      </span>
                      <span className="text-sm text-muted-foreground">{t('perYear')}</span>
                      <Badge variant="outline" className="text-emerald-500">
                        {t('yearlySave')}
                      </Badge>
                    </div>
                    <p
                      className="px-2 text-xs text-muted-foreground tabular-nums"
                      data-testid={`yearly-note-${tier.key}`}
                    >
                      {t('perMonthEquiv', {
                        price: usd.format(Math.round(tierAmount(tier.key, 'yearly') / 12)),
                      })}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">{t(`tiers.${tier.key}.tagline`)}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex-1 space-y-2.5">
                  {Array.from({ length: tier.featureCount }, (_, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">
                        {t(`tiers.${tier.key}.f${i + 1}`)}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.popular ? 'default' : 'outline'}
                  className="w-full"
                  disabled={loadingTier !== null}
                  onClick={() => void startCheckout(tier.key)}
                  data-testid={`checkout-${tier.key}`}
                >
                  {loadingTier === tier.key
                    ? t('processing')
                    : tier.key === 'free'
                      ? t('ctaFree')
                      : t('ctaPaid')}
                </Button>
                {tier.key !== 'free' && (
                  <p className="text-center text-[11px] leading-tight text-muted-foreground">
                    {t('trialNote')}
                  </p>
                )}
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* Full comparison table — every plan's monthly and yearly price. */}
      <div className="mt-12">
        <h3 className="mb-4 text-center text-lg font-semibold">{t('compareTitle')}</h3>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-sm" data-testid="pricing-compare">
            <thead>
              <tr className="border-b bg-card/50">
                <th className="px-4 py-3 text-left font-medium">{t('compareCols.plan')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('compareCols.monthly')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('compareCols.yearly')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('compareCols.perMonthYearly')}
                </th>
                <th className="px-4 py-3 text-right font-medium">{t('compareCols.save')}</th>
              </tr>
            </thead>
            <tbody>
              {pricingTiers.map((tier) => {
                const m = tierAmount(tier.key, 'monthly')
                const y = tierAmount(tier.key, 'yearly')
                const isFree = tier.key === 'free'
                return (
                  <tr
                    key={tier.key}
                    className="border-b last:border-0"
                    data-testid={`compare-row-${tier.key}`}
                  >
                    <td className="px-4 py-3 text-left font-medium">
                      {t(`tiers.${tier.key}.name`)}
                      {tier.popular && (
                        <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                          {t('popular')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {isFree ? usd.format(0) : `${usd.format(m)}${t('perMonth')}`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {isFree ? '—' : `${usd.format(y)}${t('perYear')}`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {isFree ? '—' : `${usd.format(Math.round(y / 12))}${t('perMonth')}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isFree ? (
                        '—'
                      ) : (
                        <span className="tabular-nums text-emerald-500">
                          {usd.format(m * 12 - y)} {t('compareSaveSuffix')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 space-y-1 text-center">
        {checkoutError && <p className="text-sm text-red-500">{t('checkoutError')}</p>}
        <p className="text-xs text-muted-foreground">{t('currencyNote')}</p>
        <p className="text-xs text-muted-foreground">{t('disclaimer')}</p>
      </div>
    </Section>
  )
}
