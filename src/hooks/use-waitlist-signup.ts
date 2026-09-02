'use client'

import { useCallback, useState } from 'react'
import { useLocale } from 'next-intl'

export type WaitlistStatus = 'idle' | 'sending' | 'sent' | 'error'

// The one place that talks to POST /api/waitlist. Used by the visible
// section on the home page (no plan → generic interest) and by the per-plan
// dialog behind the paid CTAs.
export function useWaitlistSignup() {
  const locale = useLocale()
  const [status, setStatus] = useState<WaitlistStatus>('idle')

  const submit = useCallback(
    async (email: string, plan?: string | null) => {
      setStatus('sending')
      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, locale, ...(plan ? { plan } : {}) }),
        })
        if (!res.ok) throw new Error(`waitlist → ${res.status}`)
        setStatus('sent')
      } catch {
        setStatus('error')
      }
    },
    [locale]
  )

  const reset = useCallback(() => setStatus('idle'), [])

  return { status, submit, reset }
}
