import type { Metadata } from 'next'
import { SignIn } from '@clerk/nextjs'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('signIn'), robots: { index: false, follow: false } }
}

export default async function SignInPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  return (
    <div className="flex justify-center py-12">
      <SignIn path={`/${locale}/sign-in`} />
    </div>
  )
}
