'use client'

import { useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { useDialogShell } from '@/hooks/use-dialog-shell'
import { Button } from '@/components/ui/button'

type Props = { open: boolean; onClose: () => void }

const fieldClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary'

/**
 * Contact Sales form for the quote-only Enterprise tier. Submissions are
 * stored as leads (POST /api/enterprise/inquiry) and notify operators in-app;
 * there is no Stripe price and nothing is charged here.
 */
export function EnterpriseContactDialog({ open, onClose }: Props) {
  const t = useTranslations('home.pricing.enterprise.form')
  const locale = useLocale()
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useDialogShell({ open, onClose, initialFocusRef: firstFieldRef, onOpen: () => setStatus('idle') })

  if (!open) return null

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus('sending')
    try {
      const res = await fetch('/api/enterprise/inquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          organization: String(form.get('organization') ?? ''),
          teamSize: String(form.get('teamSize') ?? ''),
          useCase: String(form.get('useCase') ?? ''),
          locale,
        }),
      })
      if (!res.ok) throw new Error('submit failed')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-xl border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="enterprise-dialog"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 id={titleId} className="pr-6 text-lg font-semibold">
          {t('title')}
        </h3>

        {status === 'sent' ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-emerald-500" data-testid="enterprise-sent">
              {t('success')}
            </p>
            <Button variant="outline" className="w-full" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <label htmlFor="ent-email" className="text-xs font-medium text-muted-foreground">
                {t('email')}
              </label>
              <input
                ref={firstFieldRef}
                id="ent-email"
                name="email"
                type="email"
                required
                maxLength={200}
                className={fieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ent-org" className="text-xs font-medium text-muted-foreground">
                {t('organization')}
              </label>
              <input
                id="ent-org"
                name="organization"
                type="text"
                required
                maxLength={200}
                className={fieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ent-team" className="text-xs font-medium text-muted-foreground">
                {t('teamSize')}
              </label>
              <input
                id="ent-team"
                name="teamSize"
                type="text"
                required
                maxLength={100}
                className={fieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ent-use" className="text-xs font-medium text-muted-foreground">
                {t('useCase')}
              </label>
              <textarea
                id="ent-use"
                name="useCase"
                required
                maxLength={2000}
                rows={4}
                className={`${fieldClass} resize-y`}
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-500" data-testid="enterprise-error">
                {t('error')}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={status === 'sending'}>
              {status === 'sending' ? t('sending') : t('submit')}
            </Button>

            <p className="text-center text-[11px] leading-tight text-muted-foreground">
              {t('replyNote')}
            </p>
            <p className="text-center text-[11px] leading-tight text-muted-foreground">
              {t('privacyNote')}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
