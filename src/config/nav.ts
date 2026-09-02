import {
  Bell,
  Briefcase,
  Code2,
  FileText,
  Fish,
  Gauge,
  Gift,
  GraduationCap,
  Home,
  ListFilter,
  MapPin,
  Newspaper,
  Shapes,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavKey =
  | 'home'
  | 'score'
  | 'screener'
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

// Primary destinations — shown first, ungrouped: the home page and the
// Crypto Map (the home page's main view, so it gets top billing).
export const homeNavItem: NavItem = { key: 'home', href: '/', icon: Home }
export const mapNavItem: NavItem = { key: 'map', href: '/map', icon: MapPin }
export const primaryNavItems: NavItem[] = [homeNavItem, mapNavItem]

// Grouped navigation — the single source of truth for the top nav bar and
// the mobile menu. Sections keep the (otherwise 12-item flat) list scannable.
// 'insights' stays out of the nav (placeholder page) until it ships; the
// /insights URL keeps working.
export const navGroups: NavGroup[] = [
  {
    key: 'market',
    items: [
      { key: 'score', href: '/score', icon: Gauge },
      { key: 'screener', href: '/screener', icon: ListFilter },
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
      { key: 'referral', href: '/referral', icon: Gift },
      { key: 'apiCenter', href: '/api-center', icon: Code2 },
    ],
  },
]

// Flat list (primary + every grouped item) — used by the sitemap and footer,
// and for any consumer that just needs every nav destination.
export const navItems: NavItem[] = [...primaryNavItems, ...navGroups.flatMap((group) => group.items)]

export function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
