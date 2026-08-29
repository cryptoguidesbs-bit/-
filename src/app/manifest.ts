import type { MetadataRoute } from 'next'

// Web app manifest — lets mobile users "Add to Home Screen" and open
// CryptoGuide as a standalone app. Served at /manifest.webmanifest
// (CSP: manifest-src 'self').
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CryptoGuide',
    short_name: 'CryptoGuide',
    description:
      'Real-time prices, AI news digests, daily market briefings, on-chain data and a global crypto payment map.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0F1A',
    theme_color: '#0B0F1A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
