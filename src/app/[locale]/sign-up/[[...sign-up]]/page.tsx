import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SignUpWithConsent } from '@/components/auth/sign-up-with-consent'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('signUp') }
}

export default function SignUpPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  return <SignUpWithConsent locale={locale} />
}
