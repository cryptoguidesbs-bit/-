import { useTranslations } from 'next-intl'

import { legalSlugs } from '@/config/legal'
import { navItems } from '@/config/nav'
import { Link } from '@/i18n/navigation'

export function SiteFooter() {
  const t = useTranslations('footer')
  const tNav = useTranslations('nav')
  const tLegal = useTranslations('legal')
  const tCommon = useTranslations('common')
  const year = new Date().getFullYear()

  return (
    <footer className="border-t">
      <div className="container grid gap-10 py-10 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-4">
          <p className="font-semibold tracking-tight">{tCommon('appName')}</p>
          {/* Global disclaimer — full legal documents land in stage 22 and are
              linked from the "legal" column below. */}
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            {t('disclaimer')}
          </p>
        </div>

        <nav aria-label={t('navigation')} className="space-y-3">
          <p className="text-sm font-medium">{t('navigation')}</p>
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {tNav(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t('legal')} className="space-y-3">
          <p className="text-sm font-medium">{t('legal')}</p>
          <ul className="space-y-2">
            {legalSlugs.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/legal/${slug}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {tLegal(`${slug}.title`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t">
        <div className="container flex h-12 items-center">
          <p className="text-xs text-muted-foreground">
            © {year} {tCommon('appName')}. {t('rights')}
          </p>
        </div>
      </div>
    </footer>
  )
}
