import {
  Bell,
  Briefcase,
  Code2,
  FileText,
  Fish,
  Gift,
  GraduationCap,
  Home,
  MapPin,
  Newspaper,
  Shapes,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavKey =
  | 'home'
  | 'news'
  | 'brief'
  | 'patterns'
  | 'portfolio'
  | 'onchain'
  | 'reports'
  | 'education'
  | 'alerts'
  | 'referral'
  | 'apiCenter'
  | 'map'

export type NavItem = {
  key: NavKey
  href: string
  icon: LucideIcon
}

export type NavGroupKey = 'market' | 'research' | 'tools' | 'more'

export type NavGroup = {
  key: NavGroupKey
  items: NavItem[]
}

// Home stands alone at the top of the nav, above the grouped sections.
export const homeNavItem: NavItem = { key: 'home', href: '/', icon: Home }

// Grouped navigation — the single source of truth for the sidebar and the
// mobile menu. Sections keep the (otherwise 12-item flat) list scannable.
// 'insights' stays out of the nav (placeholder page) until it ships; the
// /insights URL keeps working.
export const navGroups: NavGroup[] = [
  {
    key: 'market',
    items: [
      { key: 'news', href: '/news', icon: Newspaper },
      { key: 'brief', href: '/brief', icon: Sparkles },
      { key: 'onchain', href: '/onchain', icon: Fish },
    ],
  },
  {
    key: 'research',
    items: [
      { key: 'patterns', href: '/patterns', icon: Shapes },
      { key: 'reports', href: '/reports', icon: FileText },
      { key: 'education', href: '/education', icon: GraduationCap },
    ],
  },
  {
    key: 'tools',
    items: [
      { key: 'portfolio', href: '/portfolio', icon: Briefcase },
      { key: 'alerts', href: '/alerts', icon: Bell },
    ],
  },
  {
    key: 'more',
    items: [
      { key: 'map', href: '/map', icon: MapPin },
      { key: 'referral', href: '/referral', icon: Gift },
      { key: 'apiCenter', href: '/api-center', icon: Code2 },
    ],
  },
]

// Flat list (home + every grouped item) — used by the sitemap and footer,
// and for any consumer that just needs every nav destination.
export const navItems: NavItem[] = [homeNavItem, ...navGroups.flatMap((group) => group.items)]

export function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
