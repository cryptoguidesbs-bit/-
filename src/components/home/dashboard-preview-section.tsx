import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Section } from '@/components/home/section'
import { Link } from '@/i18n/navigation'

// Real screenshots of the live service (public pages only) instead of a mock:
// honest proof beats a decorative window. Files live in /public/screenshots
// per locale; refresh them when those pages change materially.
const SHOTS = [
  { key: 'brief', href: '/brief', height: 510 },
  { key: 'news', href: '/news', height: 530 },
] as const

export async function DashboardPreviewSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home.preview' })
  const imgLocale = locale === 'ko' ? 'ko' : 'en'

  return (
    <Section id="preview" title={t('title')} subtitle={t('subtitle')}>
      <div className="grid gap-6 md:grid-cols-2">
        {SHOTS.map(({ key, href, height }) => (
          <figure
            key={key}
            className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-primary/5"
            data-testid={`preview-shot-${key}`}
          >
            <div className="border-b bg-background/60">
              <Image
                src={`/screenshots/preview-${key}-${imgLocale}.webp`}
                alt={t(`${key}.alt`)}
                width={1600}
                height={height}
                className="w-full"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
            <figcaption className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold">{t(`${key}.caption`)}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t(`${key}.description`)}
                </p>
              </div>
              <Link
                href={href}
                className="shrink-0 whitespace-nowrap text-xs font-medium text-primary hover:underline"
              >
                {t('open')}
                <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
              </Link>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">{t('caption')}</p>
    </Section>
  )
}
