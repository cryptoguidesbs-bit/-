'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'

// Fires one first-party page-view event per page load (not per re-render,
// not twice under React StrictMode, not again on client-side re-visits in
// the same tab within the session). Uses sendBeacon when available so it
// never delays navigation; failures are ignored.
export function TrackView({ name }: { name: string }) {
  const locale = useLocale()
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    const key = `cg-view:${name}:${window.location.pathname}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      /* private mode — still send once */
    }
    const body = JSON.stringify({ name, path: window.location.pathname, locale })
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))
      } else {
        void fetch('/api/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
        })
      }
    } catch {
      /* ignore */
    }
  }, [name, locale])

  return null
}
