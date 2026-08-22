import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { AuthButtons } from '@/components/auth/auth-buttons'
import { CgMark } from '@/components/cg-mark'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { MobileNav } from '@/components/mobile-nav'
import { TopNav } from '@/components/top-nav'

export function SiteHeader() {
  const t = useTranslations('common')

  // Two rows on lg+: brand/account row, then the full navigation row (TopNav)
  // so every destination is visible at a glance. Below lg the second row is
  // hidden and the hamburger (MobileNav) carries the same menu.
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <CgMark className="h-6 w-6" />
          <span translate="no">{t('appName')}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden lg:block">
            <LocaleSwitcher />
          </div>
          <AuthButtons />
          <MobileNav />
        </div>
      </div>
      <TopNav />
    </header>
  )
}
