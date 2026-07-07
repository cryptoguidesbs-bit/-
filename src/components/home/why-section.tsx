import { Activity, Brain, ShieldCheck, Waves } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Card, CardContent } from '@/components/ui/card'
import { Section } from '@/components/home/section'
import { Reveal } from '@/components/home/reveal'

const items: { key: 'ai' | 'realtime' | 'onchain' | 'transparency'; icon: LucideIcon }[] = [
  { key: 'ai', icon: Brain },
  { key: 'realtime', icon: Activity },
  { key: 'onchain', icon: Waves },
  { key: 'transparency', icon: ShieldCheck },
]

// Server component — static feature grid, no client JS beyond the Reveal leaf.
export async function WhySection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home.why' })

  return (
    <Section id="features" title={t('title')} subtitle={t('subtitle')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ key, icon: Icon }, index) => (
          <Reveal key={key} delay={index * 80}>
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
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
