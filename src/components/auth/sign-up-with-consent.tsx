'use client'

import { useEffect, useState } from 'react'
import { SignUp } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'

import { CONSENT_COOKIE, CONSENT_VERSION } from '@/config/consent'
import { ConsentCheckbox } from '@/components/auth/consent-checkbox'

function hasConsentCookie() {
  return document.cookie.split('; ').some((c) => c.startsWith(`${CONSENT_COOKIE}=`))
}

// Sign-up flow with the mandatory consent step: the Clerk form only appears
// after the user ticks the "not investment advice" checkbox. The choice is
// kept in a cookie so multi-step sign-up (e-mail verification) survives
// remounts, and so the ConsentGate can persist it to ConsentLog right after
// the account is created.
export function SignUpWithConsent({ locale }: { locale: string }) {
  const t = useTranslations('auth.consent')
  const [agreed, setAgreed] = useState(false)

  // Restore the choice after navigation within the sign-up flow.
  useEffect(() => {
    if (hasConsentCookie()) setAgreed(true)
  }, [])

  const handleChange = (checked: boolean) => {
    setAgreed(checked)
    if (checked) {
      document.cookie = `${CONSENT_COOKIE}=${CONSENT_VERSION}; path=/; max-age=3600; samesite=lax`
    } else {
      document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0`
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-12">
      <ConsentCheckbox checked={agreed} onCheckedChange={handleChange} />
      {agreed ? (
        <div className="flex justify-center">
          <SignUp path={`/${locale}/sign-up`} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t('requiredNotice')}
        </p>
      )}
    </div>
  )
}
