'use client'

import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { VerticalMeter } from '@/components/ui/vertical-meter'
import { cn } from '@/lib/utils'

// Shared shell for the two home dashboard gauges (Market Score, Fear &
// Greed): title block on the left, big number + caption + vertical meter on
// the right. Each gauge supplies its own value color and meter gradient.
export function GaugeCard({
  title,
  subtitle,
  footer,
  value,
  valueClass,
  caption,
  meterGradient,
  loading,
  aside,
  testId,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** Slot under the subtitle — status line, link, retry button. */
  footer?: ReactNode
  value: number | null
  valueClass?: string
  caption?: ReactNode
  meterGradient: string
  loading?: ReactNode
  /** Replaces the number+meter block (e.g. a retry button when there is no data). */
  aside?: ReactNode
  testId?: string
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex items-center justify-between gap-6 p-5">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {footer}
        </div>

        {loading}

        {!loading && aside}

        {!loading && !aside && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={cn('text-4xl font-bold tabular-nums', valueClass)}>{value ?? '—'}</p>
              {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
            </div>
            <VerticalMeter value={value} gradientClass={meterGradient} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
