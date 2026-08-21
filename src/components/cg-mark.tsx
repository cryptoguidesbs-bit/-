type Props = { className?: string }

/**
 * CryptoGuide "CG" mark — white wordmark letters on an indigo-to-purple
 * gradient tile. Used in the header lockup and as the app icon.
 */
export function CgMark({ className }: Props) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient
          id="cgMarkGrad"
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill="url(#cgMarkGrad)" />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="46"
        fontWeight="800"
        letterSpacing="-1.5"
        fill="#ffffff"
      >
        CG
      </text>
    </svg>
  )
}
