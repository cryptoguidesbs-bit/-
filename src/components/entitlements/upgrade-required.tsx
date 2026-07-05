import { Globe, Lock, LogIn } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { FeatureCheck } from '@/lib/entitlements'
import { planLabels } from '@/lib/payments/plans'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'

const PLAN_LABEL: Record<string, string> = { FREE: 'Free', ...toDisplay() }

function toDisplay() {
  const out: Record<string, string> = {}
  for (const [key, label] of Object.entries(planLabels)) out[key.toUpperCase()] = label
  return out
}

// Rendered in place of gated content. Explains WHY access is blocked
// (sign-in needed / higher plan needed / region policy) and offers the
// matching next step.
export function UpgradeRequired({ gate }: { gate: FeatureCheck }) {
  const t = useTranslations('entitlements')

  const icon =
    gate.reason === 'region' ? (
      <Globe className="h-6 w-6 text-muted-foreground" />
    ) : gate.reason === 'auth' ? (
      <LogIn className="h-6 w-6 text-muted-foreground" />
    ) : (
      <Lock className="h-6 w-6 text-muted-foreground" />
    )

  return (
    <div className="flex justify-center py-16" data-testid={`gate-${gate.reason}`}>
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            {icon}
          </div>

          {gate.reason === 'region' ? (
            <>
              <h1 className="text-xl font-semibold">{t('regionTitle')}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('regionDescription')}
              </p>
            </>
          ) : gate.reason === 'auth' ? (
            <>
              <h1 className="text-xl font-semibold">{t('signInTitle')}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('signInDescription')}
              </p>
              <Button asChild>
                <Link href="/sign-in">{t('signIn')}</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">{t('lockedTitle')}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('lockedDescription', {
                  plan: PLAN_LABEL[gate.requiredPlan] ?? gate.requiredPlan,
                })}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {t('currentPlanLabel')}
                <Badge variant="secondary">{PLAN_LABEL[gate.plan] ?? gate.plan}</Badge>
              </div>
              <Button asChild>
                <Link href="/#pricing">{t('viewPricing')}</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
