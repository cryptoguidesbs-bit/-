'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

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
      {/* Floating gradient blobs */}
      <motion.div
        className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        animate={{ x: [0, 40, -20, 0], y: [0, 20, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"
        animate={{ x: [0, -30, 10, 0], y: [0, 30, -10, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl"
        animate={{ x: [0, 30, -30, 0], y: [0, -20, 10, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

export function HeroSection() {
  const t = useTranslations('home.hero')

  return (
    <section className="relative mt-6">
      <AnimatedBackground />
      <div className="flex flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="secondary">{t('badge')}</Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-6xl"
        >
          {t('title')}{' '}
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            {t('titleHighlight')}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl text-balance text-lg text-muted-foreground"
        >
          {t('subtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button size="lg" asChild>
            <a href="#pricing">{t('ctaPrimary')}</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#features">{t('ctaSecondary')}</a>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="text-xs text-muted-foreground"
        >
          {t('disclaimer')}
        </motion.p>
      </div>
    </section>
  )
}
