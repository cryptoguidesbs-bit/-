'use client'

import { BellRing, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useWaitlistSignup } from '@/hooks/use-waitlist-signup'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/home/reveal'

// Visible waitlist capture above the pricing grid. Submits without a plan
// (generic interest); a later per-plan submit from the pricing dialog
// upgrades the same row — see useWaitlistSignup.
export function WaitlistSection() {
  const t = useTranslations('home.waitlistSection')
  const { status, submit } = useWaitlistSignup()

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void submit(String(form.get('email') ?? ''))
  }

  return (
    <section className="scroll-mt-20 pb-4 lg:scroll-mt-28" data-testid="waitlist-section">
      <Reveal>
        <div className="rounded-xl border bg-card p-6 md:p-8">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <BellRing className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
                <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{t('subtitle')}</p>
              </div>
            </div>

            {status === 'sent' ? (
              <p
                className="flex items-center gap-2 text-sm font-medium text-emerald-500"
                data-testid="waitlist-section-success"
              >
                <Check className="h-4 w-4" />
                {t('success')}
              </p>
            ) : (
              <form
                onSubmit={onSubmit}
                className="flex w-full max-w-md items-center gap-2 md:w-auto"
              >
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={200}
                  aria-label={t('emailLabel')}
                  placeholder={t('emailPlaceholder')}
                  className="h-10 w-full min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary md:w-64"
                  data-testid="waitlist-section-email"
                />
                <Button type="submit" disabled={status === 'sending'} className="shrink-0">
                  {status === 'sending' ? t('sending') : t('submit')}
                </Button>
              </form>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {status === 'error' ? (
              <span className="text-red-500">{t('error')}</span>
            ) : (
              t('privacyNote')
            )}
          </p>
        </div>
      </Reveal>
    </section>
  )
}
