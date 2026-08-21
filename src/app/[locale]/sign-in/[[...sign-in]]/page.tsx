import type { Metadata } from 'next'
import { SignIn } from '@clerk/nextjs'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('signIn'), robots: { index: false, follow: false } }
}

export default function SignInPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  return (
    <div className="flex justify-center py-12">
      <SignIn path={`/${locale}/sign-in`} />
    </div>
  )
}
