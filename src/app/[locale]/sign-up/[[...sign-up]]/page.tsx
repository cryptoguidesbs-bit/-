import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SignUpWithConsent } from '@/components/auth/sign-up-with-consent'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('signUp'), robots: { index: false, follow: false } }
}

export default async function SignUpPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  return <SignUpWithConsent locale={locale} />
}
