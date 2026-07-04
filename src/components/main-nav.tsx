'use client'

import { useTranslations } from 'next-intl'

import { isNavActive, navItems } from '@/config/nav'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export function MainNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  return (
    <nav className="hidden items-center gap-6 md:flex">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'text-sm font-medium transition-colors hover:text-foreground',
            isNavActive(pathname, item.href) ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {t(item.key)}
        </Link>
      ))}
    </nav>
  )
}
