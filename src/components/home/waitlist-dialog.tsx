'use client'

import { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { PricingTierKey } from '@/config/pricing'
import { useDialogShell } from '@/hooks/use-dialog-shell'
import { useWaitlistSignup } from '@/hooks/use-waitlist-signup'
import { Button } from '@/components/ui/button'

type Props = { plan: PricingTierKey | null; onClose: () => void }

/**
 * Free-first launch: paid checkout is disabled (no LLC yet, so Stripe live
 * cannot be activated). Paid-plan CTAs open this small dialog instead and
 * collect an email for the launch waitlist, tagged with the plan.
 */
export function WaitlistDialog({ plan, onClose }: Props) {
  const t = useTranslations('home.pricing.waitlist')
  const titleId = useId()
  const emailRef = useRef<HTMLInputElement>(null)
  const { status, submit, reset } = useWaitlistSignup()

  const open = plan !== null
  useDialogShell({ open, onClose, initialFocusRef: emailRef, onOpen: reset })

  if (!open) return null

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void submit(String(form.get('email') ?? ''), plan)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="waitlist-dialog"
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
        <p className="mt-1.5 text-sm text-muted-foreground">{t('description')}</p>

        {status === 'sent' ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-emerald-500" data-testid="waitlist-sent">
              {t('success')}
            </p>
            <Button variant="outline" className="w-full" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="wl-email" className="text-xs font-medium text-muted-foreground">
                {t('email')}
              </label>
              <input
                ref={emailRef}
                id="wl-email"
                name="email"
                type="email"
                required
                maxLength={200}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-500" data-testid="waitlist-error">
                {t('error')}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={status === 'sending'}>
              {status === 'sending' ? t('sending') : t('submit')}
            </Button>

            <p className="text-center text-[11px] leading-tight text-muted-foreground">
              {t('privacyNote')}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
