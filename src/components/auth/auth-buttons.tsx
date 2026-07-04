'use client'

import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { useLocale, useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

// Header auth area: sign-in/up buttons when signed out, the Clerk user
// menu (linking to our /profile page) when signed in.
export function AuthButtons() {
  const t = useTranslations('auth')
  const locale = useLocale()

  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sign-in">{t('signIn')}</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/sign-up">{t('signUp')}</Link>
        </Button>
      </SignedOut>
      <SignedIn>
        <UserButton userProfileMode="navigation" userProfileUrl={`/${locale}/profile`} />
      </SignedIn>
    </div>
  )
}
