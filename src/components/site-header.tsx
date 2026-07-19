import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { AuthButtons } from '@/components/auth/auth-buttons'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { MobileNav } from '@/components/mobile-nav'

export function SiteHeader() {
  const t = useTranslations('common')

  // Navigation lives in the sidebar (lg+) and the mobile menu (below lg), so
  // the header stays lean — no redundant top link row. The mobile menu carries
  // the locale switcher on smaller screens.
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-6">
        <Link href="/" className="font-semibold tracking-tight">
          {t('appName')}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden lg:block">
            <LocaleSwitcher />
          </div>
          <AuthButtons />
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
