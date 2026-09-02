import { cn } from '@/lib/utils'

// 0–100 vertical meter that fills from the BOTTOM. The gradient sits on the
// track so its colors stay anchored to fixed values; a cover from the top
// hides the unfilled part. (A `marginTop: %` trick does not work here —
// percentage margins resolve against the container's WIDTH, so a 2px-wide
// track would offset the bar by at most a couple of pixels.)
export function VerticalMeter({
  value,
  gradientClass,
  className,
}: {
  value: number | null
  /** Tailwind gradient classes for the track, low value at the bottom. */
  gradientClass: string
  className?: string
}) {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('relative h-16 w-2 overflow-hidden rounded-full', gradientClass, className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
    >
      <div className="absolute inset-x-0 top-0 bg-secondary" style={{ height: `${100 - v}%` }} />
    </div>
  )
}
