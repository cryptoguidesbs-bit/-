import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { koKR } from '@clerk/localizations'
import { dark } from '@clerk/themes'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'

import { routing } from '@/i18n/routing'
import { siteUrl } from '@/lib/site'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { SiteHeader } from '@/components/site-header'
import { SiteSidebar } from '@/components/site-sidebar'
import { SiteFooter } from '@/components/site-footer'
import { ConsentGate } from '@/components/auth/consent-gate'

import '../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

const OG_LOCALES: Record<string, string> = { ko: 'ko_KR', en: 'en_US' }

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t('title'),
      template: `%s | ${t('title')}`,
    },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: t('title'),
      title: t('title'),
      description: t('description'),
      locale: OG_LOCALES[locale] ?? locale,
    },
    twitter: {
      card: 'summary',
      title: t('title'),
      description: t('description'),
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }

  setRequestLocale(locale)

  const messages = await getMessages()
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans">
        <ClerkProvider
          localization={locale === 'ko' ? koKR : undefined}
          appearance={{ baseTheme: dark }}
          signInUrl={`/${locale}/sign-in`}
          signUpUrl={`/${locale}/sign-up`}
          signInFallbackRedirectUrl={`/${locale}`}
          signUpFallbackRedirectUrl={`/${locale}`}
          afterSignOutUrl={`/${locale}`}
        >
          <NextIntlClientProvider messages={messages}>
            {/* Dark-only theme: light palette stays in globals.css for a future
                light mode, but the UI is forced to dark. */}
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              forcedTheme="dark"
              enableSystem={false}
            >
              <QueryProvider>
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
                >
                  {tCommon('skipToContent')}
                </a>
                <div className="relative flex min-h-screen flex-col">
                  <SiteHeader />
                  <div className="container flex flex-1 gap-6">
                    <SiteSidebar />
                    <main id="main-content" className="min-w-0 flex-1 py-6">
                      {children}
                    </main>
                  </div>
                  <SiteFooter />
                </div>
                <ConsentGate />
              </QueryProvider>
            </ThemeProvider>
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
