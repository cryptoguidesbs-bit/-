'use client'

import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

import { pricingTiers } from '@/config/pricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Section } from '@/components/home/section'
import { cn } from '@/lib/utils'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function PricingSection() {
  const t = useTranslations('home.pricing')

  return (
    <Section id="pricing" title={t('title')} subtitle={t('subtitle')}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {pricingTiers.map((tier, index) => (
          <motion.div
            key={tier.key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: index * 0.06 }}
          >
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
                    {usd.format(tier.priceMonthly)}
                  </span>
                  <span className="text-sm text-muted-foreground">{t('perMonth')}</span>
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
                <Button variant={tier.popular ? 'default' : 'outline'} className="w-full">
                  {tier.priceMonthly === 0 ? t('ctaFree') : t('ctaPaid')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 space-y-1 text-center">
        <p className="text-xs text-muted-foreground">{t('currencyNote')}</p>
        <p className="text-xs text-muted-foreground">{t('disclaimer')}</p>
      </div>
    </Section>
  )
}
