'use client'

import type { ScoreBand } from '@/lib/market/score'
import { cn } from '@/lib/utils'

const BAND_COLOR: Record<ScoreBand, string> = {
  cold: 'text-sky-400',
  riskOff: 'text-blue-400',
  neutral: 'text-yellow-400',
  riskOn: 'text-orange-400',
  overheated: 'text-red-500',
}

export function bandColorClass(band: ScoreBand | null) {
  return band ? BAND_COLOR[band] : 'text-muted-foreground'
}

// Half-circle gauge: a cool→hot arc and a needle at the score. Pure SVG,
// no library; the number is rendered as text so it stays crisp and
// selectable.
export function MarketScoreGauge({
  score,
  band,
  label,
  size = 240,
}: {
  score: number | null
  band: ScoreBand | null
  label: string
  size?: number
}) {
  const r = 80
  const cx = 100
  const cy = 95
  const angle = score === null ? 180 : 180 - (score / 100) * 180
  const rad = (angle * Math.PI) / 180
  const nx = cx + Math.cos(rad) * (r - 8)
  const ny = cy - Math.sin(rad) * (r - 8)

  return (
    <div className="flex flex-col items-center" style={{ width: size }} data-testid="market-score-gauge">
      <svg viewBox="0 0 200 110" width={size} height={size * 0.55} aria-hidden>
        <defs>
          <linearGradient id="score-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="35%" stopColor="#60a5fa" />
            <stop offset="55%" stopColor="#facc15" />
            <stop offset="80%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#score-arc)"
          strokeWidth="14"
          strokeLinecap="round"
          opacity={score === null ? 0.25 : 0.9}
        />
        {score !== null && (
          <>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="5" fill="currentColor" />
          </>
        )}
      </svg>
      <div className="-mt-6 text-center">
        <p className={cn('text-5xl font-bold tabular-nums', bandColorClass(band))} data-testid="market-score-value">
          {score === null ? '—' : score}
        </p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
