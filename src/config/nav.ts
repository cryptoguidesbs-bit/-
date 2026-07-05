import { Briefcase, FileText, Home, LineChart, Newspaper, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavKey = 'home' | 'news' | 'brief' | 'insights' | 'portfolio' | 'reports'

export type NavItem = {
  key: NavKey
  href: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { key: 'home', href: '/', icon: Home },
  { key: 'news', href: '/news', icon: Newspaper },
  { key: 'brief', href: '/brief', icon: Sparkles },
  { key: 'insights', href: '/insights', icon: LineChart },
  { key: 'portfolio', href: '/portfolio', icon: Briefcase },
  { key: 'reports', href: '/reports', icon: FileText },
]

export function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
