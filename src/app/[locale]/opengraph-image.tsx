import { ImageResponse } from 'next/og'

// Social share card (og:image / twitter:image) — 1200×630. Rendered once per
// locale at build time. English-only on purpose: the brand is English and the
// default Satori font has no Korean glyphs (a Korean font would add ~2 MB).
export const runtime = 'edge'
export const alt = 'CryptoGuide — the clearest way to read the crypto market'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PILLS = ['Live prices', 'AI daily brief', 'News digests', 'On-chain', 'Crypto Map', 'Alerts']

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: 'linear-gradient(135deg, #0b0f1a 0%, #111827 55%, #1e1b4b 100%)',
          color: '#f8fafc',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #4f46e5, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="82" height="82" viewBox="0 0 100 100">
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
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, letterSpacing: -1.5 }}>
              <span>Crypto</span>
              <span style={{ color: '#34D399' }}>Guide</span>
            </div>
            <div style={{ fontSize: 24, color: '#a5b4fc' }}>cryptoguide.live</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.15, maxWidth: 980 }}>
            The clearest way to read the crypto market.
          </div>
          <div style={{ fontSize: 26, color: '#cbd5e1', maxWidth: 980, lineHeight: 1.35 }}>
            Real-time prices, AI news digests, a daily market brief, on-chain data and a map of places
            that accept crypto — information, not advice.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {PILLS.map((p) => (
            <div
              key={p}
              style={{
                padding: '10px 20px',
                borderRadius: 999,
                border: '1px solid rgba(165,180,252,0.45)',
                background: 'rgba(79,70,229,0.18)',
                fontSize: 22,
                color: '#e0e7ff',
              }}
            >
              {p}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
