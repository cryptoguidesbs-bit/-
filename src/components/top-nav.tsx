'use client'

import { Fragment } from 'react'
import { useTranslations } from 'next-intl'

import { isNavActive, navGroups, primaryNavItems, type NavItem } from '@/config/nav'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

// Desktop top navigation (lg+): every destination visible in one horizontal
// row under the header — primary items first, then the groups separated by
// thin dividers. Scrolls horizontally if a locale's labels overflow. Below lg
// the MobileNav hamburger takes over.
export function TopNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  const renderLink = ({ key, href, icon: Icon }: NavItem) => {
    const active = isNavActive(pathname, href)
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-9 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium transition-colors',
          active
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
        {t(key)}
      </Link>
    )
  }

  return (
    <nav
      aria-label={t('topNav')}
      data-testid="top-nav"
      className="hidden border-t lg:block"
    >
      <div className="container flex h-11 items-center gap-1 overflow-x-auto">
        {primaryNavItems.map(renderLink)}
        {navGroups.map((group) => (
          <Fragment key={group.key}>
            {/* Groups are marked by dividers only: 16 destinations no longer
                leave room for the group captions at 1280–1536px (the mobile
                menu keeps its group headings). */}
            <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-border" title={t(`groups.${group.key}`)} />
            {group.items.map(renderLink)}
          </Fragment>
        ))}
      </div>
    </nav>
  )
}
