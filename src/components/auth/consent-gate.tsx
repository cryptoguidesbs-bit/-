'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useLocale, useTranslations } from 'next-intl'

import { CONSENT_COOKIE, CONSENT_VERSION } from '@/config/consent'
import { Button } from '@/components/ui/button'
import { ConsentCheckbox } from '@/components/auth/consent-checkbox'

function hasConsentCookie() {
  return document.cookie.split('; ').some((c) => c.startsWith(`${CONSENT_COOKIE}=`))
}

function clearConsentCookie() {
  document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0`
}

// Ensures every signed-in user has a recorded consent for the current
// version. Users coming from the sign-up page already ticked the box (cookie
// present) — their consent is persisted silently. Users who signed up
// another way (e.g. OAuth from the sign-in page) get a blocking dialog.
export function ConsentGate() {
  const { user, isLoaded } = useUser()
  const locale = useLocale()
  const t = useTranslations('auth.consent')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const submittedRef = useRef(false)

  const needsConsent =
    isLoaded && !!user && user.publicMetadata?.consentVersion !== CONSENT_VERSION

  const submit = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale }),
      })
      if (res.ok) {
        clearConsentCookie()
        await user?.reload()
      } else {
        submittedRef.current = false
      }
    } catch {
      submittedRef.current = false
    } finally {
      setSubmitting(false)
      setAutoSubmitting(false)
    }
  }, [locale, user])

  // Consent already given on the sign-up page → record it silently.
  useEffect(() => {
    if (needsConsent && hasConsentCookie()) {
      setAutoSubmitting(true)
      void submit()
    }
  }, [needsConsent, submit])

  if (!needsConsent || autoSubmitting) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-xl">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('gateDescription')}</p>
        </div>
        <ConsentCheckbox checked={agreed} onCheckedChange={setAgreed} />
        <Button
          className="w-full"
          disabled={!agreed || submitting}
          onClick={() => void submit()}
          data-testid="consent-submit"
        >
          {submitting ? '…' : t('continue')}
        </Button>
      </div>
    </div>
  )
}
