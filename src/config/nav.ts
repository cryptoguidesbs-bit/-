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

export const navItems: NavItem[] = [
  { key: 'home', href: '/', icon: Home },
  { key: 'news', href: '/news', icon: Newspaper },
  { key: 'brief', href: '/brief', icon: Sparkles },
  { key: 'patterns', href: '/patterns', icon: Shapes },
  // 'insights' is still a placeholder page — hidden from nav (and thereby
  // the sitemap) until it ships; the /insights URL keeps working.
  { key: 'portfolio', href: '/portfolio', icon: Briefcase },
  { key: 'onchain', href: '/onchain', icon: Fish },
  { key: 'reports', href: '/reports', icon: FileText },
  { key: 'education', href: '/education', icon: GraduationCap },
  { key: 'alerts', href: '/alerts', icon: Bell },
  { key: 'referral', href: '/referral', icon: Gift },
  { key: 'apiCenter', href: '/api-center', icon: Code2 },
  { key: 'map', href: '/map', icon: MapPin },
]

export function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
