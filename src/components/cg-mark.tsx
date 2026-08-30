type Props = { className?: string }

/**
 * CryptoGuide compass mark — a "C" ring with a needle pointing through its
 * opening (concept: Crypto + Guide), white on the indigo-to-purple brand
 * tile. Same geometry as src/app/icon.svg and the PWA icons.
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
      <path
        d="M 53.4 22.33 A 27.88 27.88 0 1 0 77.67 46.6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={10.66}
        strokeLinecap="round"
      />
      <polygon points="77.25,22.75 45.07,45.07 54.93,54.93" fill="#34D399" />
      <polygon points="34.34,65.66 54.93,54.93 45.07,45.07" fill="#C7D2FE" />
      <circle cx="50" cy="50" r={4.1} fill="#6D5AE8" />
    </svg>
  )
}
