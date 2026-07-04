'use client'

import { useTranslations } from 'next-intl'

import { isNavActive, navItems } from '@/config/nav'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export function SiteSidebar() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  return (
    <aside
      aria-label={t('sidebar')}
      className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r lg:block"
    >
      <nav className="flex flex-col gap-1 py-6 pr-4">
        {navItems.map(({ key, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isNavActive(pathname, href)
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {t(key)}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
