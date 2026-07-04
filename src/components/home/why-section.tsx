'use client'

import { Activity, Brain, ShieldCheck, Waves } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@/components/ui/card'
import { Section } from '@/components/home/section'

const items: { key: 'ai' | 'realtime' | 'onchain' | 'transparency'; icon: LucideIcon }[] = [
  { key: 'ai', icon: Brain },
  { key: 'realtime', icon: Activity },
  { key: 'onchain', icon: Waves },
  { key: 'transparency', icon: ShieldCheck },
]

export function WhySection() {
  const t = useTranslations('home.why')

  return (
    <Section id="features" title={t('title')} subtitle={t('subtitle')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ key, icon: Icon }, index) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
          >
            <Card className="h-full">
              <CardContent className="space-y-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold">{t(`${key}.title`)}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`${key}.description`)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}
