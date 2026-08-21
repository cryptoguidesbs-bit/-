'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type PaidPlanKey = 'starter' | 'trader' | 'pro' | 'whale'
const PLANS: PaidPlanKey[] = ['starter', 'trader', 'pro', 'whale']
const inputCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary'

export function PlanManager({
  currentPlan,
  currentInterval,
}: {
  currentPlan: PaidPlanKey
  currentInterval: 'monthly' | 'yearly'
}) {
  const t = useTranslations('billing')
  const router = useRouter()

  const [plan, setPlan] = useState<PaidPlanKey>(currentPlan)
  const [interval, setInterval] = useState<'monthly' | 'yearly'>(currentInterval)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Annual refund eligibility.
  const [refundEligible, setRefundEligible] = useState(false)
  const [refunding, setRefunding] = useState(false)

  useEffect(() => {
    fetch('/api/billing/refund')
      .then((r) => r.json())
      .then((d) => setRefundEligible(!!d.eligible))
      .catch(() => setRefundEligible(false))
  }, [])

  const applyChange = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/billing/change', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'error')
      setMessage(json.direction === 'upgrade' ? t('changeUpgraded') : t('changeDowngraded'))
      router.refresh()
    } catch {
      setMessage(t('changeError'))
    } finally {
      setBusy(false)
    }
  }

  const requestRefund = async () => {
    setRefunding(true)
    setMessage(null)
    try {
      const res = await fetch('/api/billing/refund', { method: 'POST' })
      if (!res.ok) throw new Error('refund failed')
      setMessage(t('refundDone'))
      router.refresh()
    } catch {
      setMessage(t('refundError'))
    } finally {
      setRefunding(false)
    }
  }

  const unchanged = plan === currentPlan && interval === currentInterval

  return (
    <div className="space-y-4">
      <Card data-testid="plan-manager">
        <CardHeader>
          <CardTitle className="text-base">{t('changePlan')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('changePlanDescription')}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              {t('selectPlan')}
              <select className={inputCls} value={plan} onChange={(e) => setPlan(e.target.value as PaidPlanKey)}>
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              {t('selectInterval')}
              <select
                className={inputCls}
                value={interval}
                onChange={(e) => setInterval(e.target.value as 'monthly' | 'yearly')}
              >
                <option value="monthly">{t('interval.MONTHLY')}</option>
                <option value="yearly">{t('interval.YEARLY')}</option>
              </select>
            </label>
          </div>
          <Button size="sm" disabled={busy || unchanged} onClick={applyChange} data-testid="apply-plan-change">
            {busy ? '…' : t('applyChange')}
          </Button>
        </CardContent>
      </Card>

      {refundEligible && (
        <Card className="border-emerald-500/30" data-testid="refund-card">
          <CardHeader>
            <CardTitle className="text-base">{t('refundTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('refundEligible')}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={refunding}
              onClick={requestRefund}
              data-testid="request-refund"
            >
              {refunding ? '…' : t('refundButton')}
            </Button>
          </CardContent>
        </Card>
      )}

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
