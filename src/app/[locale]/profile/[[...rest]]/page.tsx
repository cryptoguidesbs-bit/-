import type { Metadata } from 'next'
import { UserProfile } from '@clerk/nextjs'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { PrivacyControls } from '@/components/profile/privacy-controls'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('profile') }
}

// Access is enforced in middleware (redirects signed-out users to sign-in).
export default function ProfilePage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <UserProfile path={`/${locale}/profile`} />
      <PrivacyControls />
    </div>
  )
}
