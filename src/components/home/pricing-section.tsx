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
      {/* Billing interval toggle */}
      <div className="mb-8 flex items-center justify-center gap-1 rounded-lg border bg-card p-1 md:w-fit">
        {(['monthly', 'yearly'] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setInterval(i)}
            aria-pressed={interval === i}
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
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  {t('popular')}
                </Badge>
              )}
              <CardHeader className="space-y-2 pb-4">
                <p className="font-semibold">{t(`tiers.${tier.key}.name`)}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">
                    {usd.format(tierAmount(tier.key, interval))}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t(interval === 'monthly' ? 'perMonth' : 'perYear')}
                  </span>
                </div>
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
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
      <div className="mt-6 space-y-1 text-center">
        {checkoutError && <p className="text-sm text-red-500">{t('checkoutError')}</p>}
        <p className="text-xs text-muted-foreground">{t('currencyNote')}</p>
        <p className="text-xs text-muted-foreground">{t('disclaimer')}</p>
      </div>
    </Section>
  )
}
