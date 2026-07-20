type Props = { className?: string }

/**
 * CryptoGuide "CG" mark — an open dial (C) with an inward bar (G): a guidance
 * dial for reading the crypto market. Monochrome: strokes use currentColor, so
 * the mark matches the wordmark (white on the app's dark header).
 */
export function CgMark({ className }: Props) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      {/* dial (C) */}
      <path
        d="M73.7 30.1 A31 31 0 1 0 73.7 69.9"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
      />
      {/* inward bar (G) */}
      <path d="M73 50 H51" stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
    </svg>
  )
}
