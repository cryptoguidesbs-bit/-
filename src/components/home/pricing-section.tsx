'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useLocale, useTranslations } from 'next-intl'

import {
  pricingTiers,
  tierTermTotal,
  tierTermPerMonth,
  tierTermUndiscounted,
  tierTermSaved,
  type PricingTierKey,
} from '@/config/pricing'
import {
  billingTerms,
  findBillingTerm,
  YEARLY_DISCOUNT_PCT,
  type BillingTermKey,
} from '@/lib/payments/plans'
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
  const [termKey, setTermKey] = useState<BillingTermKey>('1m')
  const [loadingTier, setLoadingTier] = useState<PricingTierKey | null>(null)
  const [checkoutError, setCheckoutError] = useState(false)

  const term = findBillingTerm(termKey) ?? billingTerms[0]

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
        // Month terms bill monthly, year terms bill yearly; the term is the
        // commitment length shown on the card.
        body: JSON.stringify({ plan: tier, interval: term.interval, term: term.key, locale }),
      })
      if (res.status === 401) {
        router.push('/sign-in')
        return
      }
      if (res.status === 409) {
        // Already subscribed — manage it instead.
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
      {/* Billing-term selector: months (no discount) and years (17% off). */}
      <div className="mb-3 flex flex-col items-center gap-2">
        <div className="inline-flex flex-wrap items-stretch justify-center gap-1 rounded-lg border bg-card p-1">
          {billingTerms.map((bt, i) => (
            <span key={bt.key} className="flex items-stretch">
              {i === 3 && (
                <span className="mx-1 my-1 w-px self-stretch bg-border" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => setTermKey(bt.key)}
                aria-pressed={termKey === bt.key}
                data-testid={`term-${bt.key}`}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                  termKey === bt.key
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`terms.${bt.key}`)}
                {bt.unit === 'year' && (
                  <span className="text-[10px] font-semibold text-emerald-500">
                    {`-${YEARLY_DISCOUNT_PCT}%`}
                  </span>
                )}
              </button>
            </span>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t('termHint', { pct: YEARLY_DISCOUNT_PCT })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {pricingTiers.map((tier, index) => {
          const total = tierTermTotal(tier.key, term)
          const perMonth = tierTermPerMonth(tier.key, term)
          const undiscounted = tierTermUndiscounted(tier.key, term)
          const saved = tierTermSaved(tier.key, term)
          const isYear = term.unit === 'year'
          return (
            <Reveal key={tier.key} delay={index * 60}>
              <Card
                className={cn(
                  'relative flex h-full flex-col',
                  tier.popular && 'border-primary shadow-lg shadow-primary/10',
                )}
              >
                {tier.popular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    {t('popular')}
                  </Badge>
                )}
                <CardHeader className="space-y-2 pb-4">
                  <p className="font-semibold">{t(`tiers.${tier.key}.name`)}</p>

                  {tier.key === 'free' ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold tabular-nums">{usd.format(0)}</span>
                    </div>
                  ) : (
                    <div className="space-y-1" data-testid={`price-${tier.key}`}>
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-3xl font-bold tabular-nums">{usd.format(total)}</span>
                        <span className="text-sm text-muted-foreground">
                          / {t(`terms.${termKey}`)}
                        </span>
                        {isYear && (
                          <span className="text-sm text-muted-foreground line-through tabular-nums">
                            {usd.format(undiscounted)}
                          </span>
                        )}
                      </div>
                      {/* Effective monthly cost — keeps the sticker price digestible. */}
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t('perMonthEquiv', { price: usd.format(perMonth) })}
                      </p>
                      {isYear && (
                        <p
                          className="text-xs font-medium text-emerald-500 tabular-nums"
                          data-testid={`saved-${tier.key}`}
                        >
                          {t('discountSaved', {
                            pct: YEARLY_DISCOUNT_PCT,
                            price: usd.format(saved),
                          })}
                        </p>
                      )}
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
          )
        })}
      </div>

      {/* Full comparison table — every plan across every term, real prices. */}
      <div className="mt-12">
        <h3 className="mb-4 text-center text-lg font-semibold">{t('compareTitle')}</h3>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm" data-testid="pricing-compare">
            <thead>
              <tr className="border-b bg-card/50">
                <th className="px-4 py-3 text-left font-medium">{t('compareCols.plan')}</th>
                {billingTerms.map((bt) => (
                  <th key={bt.key} className="px-4 py-3 text-right font-medium">
                    <span className="inline-flex items-center gap-1">
                      {t(`terms.${bt.key}`)}
                      {bt.unit === 'year' && (
                        <span className="text-[10px] font-semibold text-emerald-500">
                          {`-${YEARLY_DISCOUNT_PCT}%`}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pricingTiers.map((tier) => {
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
                    {billingTerms.map((bt) => {
                      if (isFree) {
                        return (
                          <td
                            key={bt.key}
                            className="px-4 py-3 text-right tabular-nums text-muted-foreground"
                          >
                            {bt.key === '1m' ? usd.format(0) : '—'}
                          </td>
                        )
                      }
                      const saved = tierTermSaved(tier.key, bt)
                      return (
                        <td key={bt.key} className="px-4 py-3 text-right">
                          <div className="font-medium tabular-nums">
                            {usd.format(tierTermTotal(tier.key, bt))}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {t('perMonthEquiv', {
                              price: usd.format(tierTermPerMonth(tier.key, bt)),
                            })}
                          </div>
                          {bt.unit === 'year' && (
                            <div className="text-xs font-medium text-emerald-500 tabular-nums">
                              {usd.format(saved)} {t('compareSaveSuffix')}
                            </div>
                          )}
                        </td>
                      )
                    })}
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
