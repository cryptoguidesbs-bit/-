import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'

export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  const t = useTranslations('common')

  return (
    <div className="flex flex-col items-start gap-4 py-10">
      <Badge variant="secondary">{t('comingSoon')}</Badge>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-prose text-muted-foreground">{description}</p>
    </div>
  )
}
