import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function AnimatedBackground() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-2xl">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)',
        }}
      />
      {/* Floating gradient blobs — CSS keyframes, no JS. */}
      <div className="blob-a absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="blob-b absolute -right-24 top-10 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="blob-c absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
    </div>
  )
}

// Server component — above-the-fold, rendered on the server for a fast LCP.
// Entrance animation is pure CSS (animates on load).
export async function HeroSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home.hero' })

  return (
    <section className="relative mt-6">
      <AnimatedBackground />
      <div className="flex flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
        <div className="rise-in">
          <Badge variant="secondary">{t('badge')}</Badge>
        </div>

        <h1
          className="rise-in max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-6xl"
          style={{ '--rise-delay': '100ms' } as React.CSSProperties}
        >
          {t('title')}{' '}
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            {t('titleHighlight')}
          </span>
        </h1>

        <p
          className="rise-in max-w-2xl text-balance text-lg text-muted-foreground"
          style={{ '--rise-delay': '200ms' } as React.CSSProperties}
        >
          {t('subtitle')}
        </p>

        <div
          className="rise-in flex flex-wrap items-center justify-center gap-3"
          style={{ '--rise-delay': '300ms' } as React.CSSProperties}
        >
          <Button size="lg" asChild>
            <a href="#pricing">{t('ctaPrimary')}</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#features">{t('ctaSecondary')}</a>
          </Button>
        </div>

        <p
          className="rise-in text-xs text-muted-foreground"
          style={{ '--rise-delay': '450ms' } as React.CSSProperties}
        >
          {t('disclaimer')}
        </p>
      </div>
    </section>
  )
}
