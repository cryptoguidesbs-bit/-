'use client'

import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

export function Section({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id?: string
  title?: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('scroll-mt-20 py-14 md:py-20', className)}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {title && <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>}
        {subtitle && <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>}
        <div className={title ? 'mt-10' : undefined}>{children}</div>
      </motion.div>
    </section>
  )
}
