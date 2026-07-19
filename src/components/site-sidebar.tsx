'use client'

import { useTranslations } from 'next-intl'

import { homeNavItem, isNavActive, navGroups, type NavItem } from '@/config/nav'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export function SiteSidebar() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  const linkClass = (href: string) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isNavActive(pathname, href)
        ? 'bg-secondary text-foreground'
        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
    )

  const renderLink = ({ key, href, icon: Icon }: NavItem) => (
    <Link key={href} href={href} className={linkClass(href)}>
      <Icon className="h-4 w-4" />
      {t(key)}
    </Link>
  )

  return (
    <aside
      aria-label={t('sidebar')}
      className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r lg:block"
    >
      <nav className="flex flex-col gap-1 py-6 pr-4">
        {renderLink(homeNavItem)}
        {navGroups.map((group) => (
          <div key={group.key} className="mt-5 flex flex-col gap-1 first:mt-3">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {t(`groups.${group.key}`)}
            </p>
            {group.items.map(renderLink)}
          </div>
        ))}
      </nav>
    </aside>
  )
}
