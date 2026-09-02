'use client'

import { AlertTriangle, Clock, Info } from 'lucide-react'
import { useFormatter, useNow, useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

// One way to say "how good is this data" everywhere (spec §3-2):
//   unavailable — nothing to show (never a made-up number)
//   partial     — some inputs missing; names them
//   stale       — served from the last good value; shows its age
//   fresh       — "Updated 3 minutes ago"
// Age uses next-intl's clock (`useNow`) so render stays pure and SSR-safe.
export function DataStatus({
  updatedAt,
  stale = false,
  partial = false,
  unavailable = false,
  missing = [],
  className,
}: {
  updatedAt: string | null
  stale?: boolean
  partial?: boolean
  unavailable?: boolean
  /** Human-readable names of missing inputs (already localized). */
  missing?: string[]
  className?: string
}) {
  const t = useTranslations('common.dataStatus')
  const format = useFormatter()
  const now = useNow({ updateInterval: 30_000 })

  if (unavailable) {
    return (
      <p className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)} data-testid="data-status-unavailable">
        <Info className="h-3.5 w-3.5" />
        {t('unavailable')}
      </p>
    )
  }

  // Server and client clocks can differ by a second or two — never show a
  // timestamp as being in the future.
  const at = updatedAt ? new Date(Math.min(new Date(updatedAt).getTime(), now.getTime())) : null
  const age = at ? format.relativeTime(at, now) : t('unknownTime')

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', className)} data-testid="data-status">
      <span className={cn('flex items-center gap-1.5', stale ? 'text-yellow-500' : 'text-muted-foreground')}>
        {stale ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        {stale ? t('stale', { age }) : t('updated', { age })}
      </span>
      {partial && (
        <span className="flex items-center gap-1.5 text-yellow-500" data-testid="data-status-partial">
          <AlertTriangle className="h-3.5 w-3.5" />
          {missing.length > 0 ? t('partialNamed', { missing: missing.join(', ') }) : t('partial')}
        </span>
      )}
    </div>
  )
}
