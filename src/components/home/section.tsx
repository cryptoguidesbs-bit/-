import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { Reveal } from '@/components/home/reveal'

// Presentational section shell (no hooks / no data fetching), usable from
// both server and client trees. Scroll-in handled by the CSS Reveal leaf.
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
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('scroll-mt-20 py-14 md:py-20', className)}>
      <Reveal>
        {title && <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>}
        {subtitle && <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>}
        <div className={title ? 'mt-10' : undefined}>{children}</div>
      </Reveal>
    </section>
  )
}
