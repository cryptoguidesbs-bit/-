'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { homeNavItem, isNavActive, navGroups, type NavItem } from '@/config/nav'
import { Link, usePathname } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')

  // Close the panel whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll while the panel is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const renderLink = ({ key, href, icon: Icon }: NavItem) => (
    <Link
      key={href}
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors',
        isNavActive(pathname, href)
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
      )}
    >
      <Icon className="h-5 w-5" />
      {t(key)}
    </Link>
  )

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? tCommon('closeMenu') : tCommon('openMenu')}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-14 z-40 h-[calc(100vh-3.5rem)] overflow-y-auto border-t bg-background"
        >
          <nav className="container flex flex-col gap-1 py-4">
            {renderLink(homeNavItem)}
            {navGroups.map((group) => (
              <div key={group.key} className="mt-4 flex flex-col gap-1">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {t(`groups.${group.key}`)}
                </p>
                {group.items.map(renderLink)}
              </div>
            ))}

            <div className="mt-6 border-t pt-4">
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tCommon('language')}
              </p>
              <div className="px-3">
                <LocaleSwitcher />
              </div>
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
