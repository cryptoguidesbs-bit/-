'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

export function CancelSubscriptionButton() {
  const t = useTranslations('billing')
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)

  const cancel = async () => {
    setSubmitting(true)
    setError(false)
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      if (!res.ok) throw new Error('cancel failed')
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirming(true)}
          data-testid="cancel-subscription"
        >
          {t('cancel')}
        </Button>
        {error && <p className="text-sm text-red-500">{t('cancelError')}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{t('cancelConfirm')}</p>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={submitting}
          onClick={() => void cancel()}
          data-testid="cancel-confirm"
        >
          {submitting ? '…' : t('cancelYes')}
        </Button>
        <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setConfirming(false)}>
          {t('cancelNo')}
        </Button>
      </div>
    </div>
  )
}
