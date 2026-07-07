import { Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Section } from '@/components/home/section'

// Server component — static marketing content, no client JS.
export async function AiBriefSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home.brief' })

  return (
    <Section id="brief" title={t('title')} subtitle={t('subtitle')}>
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">{t('headline')}</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">{t('generatedNote')}</p>
          </div>
          <Badge variant="outline">{t('sampleLabel')}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {(['p1', 'p2', 'p3'] as const).map((key) => (
              <li key={key} className="flex gap-3 text-sm leading-relaxed">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-muted-foreground">{t(key)}</span>
              </li>
            ))}
          </ul>
          <p className="border-t pt-4 text-xs text-muted-foreground">{t('disclaimer')}</p>
        </CardContent>
      </Card>
    </Section>
  )
}
