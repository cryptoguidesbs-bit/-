'use client'

import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

// The explicit "not investment advice · informational/educational purposes"
// consent checkbox, shared by the sign-up page and the post-OAuth gate.
export function ConsentCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const t = useTranslations('auth.consent')

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
        data-testid="consent-checkbox"
      />
      <span className="space-y-1.5 text-sm">
        <span className="block font-medium leading-snug">{t('checkboxLabel')}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {t('description')}{' '}
          <Link href="/legal/disclaimer" className="underline hover:text-foreground">
            {t('disclaimerLink')}
          </Link>
        </span>
      </span>
    </label>
  )
}
