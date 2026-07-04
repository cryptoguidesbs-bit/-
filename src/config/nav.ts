import { Briefcase, FileText, Home, LineChart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavKey = 'home' | 'insights' | 'portfolio' | 'reports'

export type NavItem = {
  key: NavKey
  href: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { key: 'home', href: '/', icon: Home },
  { key: 'insights', href: '/insights', icon: LineChart },
  { key: 'portfolio', href: '/portfolio', icon: Briefcase },
  { key: 'reports', href: '/reports', icon: FileText },
]

export function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
