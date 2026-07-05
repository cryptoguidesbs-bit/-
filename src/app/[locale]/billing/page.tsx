import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getPaymentProvider } from '@/lib/payments'
import { syncSubscriptionToDb } from '@/lib/payments/sync'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CancelSubscriptionButton } from '@/components/billing/cancel-subscription-button'
import { Link } from '@/i18n/navigation'

type Props = {
  params: { locale: string }
  searchParams: { session_id?: string }
}

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'billing' })
  return { title: t('title') }
}

const ENTITLED = new Set(['ACTIVE', 'TRIALING', 'PAST_DUE'])

export default async function BillingPage({ params: { locale }, searchParams }: Props) {
  setRequestLocale(locale)

  const { userId: clerkId } = await auth()
  if (!clerkId) redirect(`/${locale}/sign-in`)

  const t = await getTranslations({ locale, namespace: 'billing' })

  let user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: true },
  })

  // Just returned from checkout: reconcile immediately instead of waiting
  // for the webhook.
  const sessionId = searchParams.session_id
  let justCompleted = false
  if (sessionId && user) {
    try {
      const info = await getPaymentProvider().getCheckoutSession?.(sessionId)
      if (info?.userId === user.id && info.subscription) {
        await syncSubscriptionToDb(user.id, info.subscription)
        justCompleted = true
        user = await prisma.user.findUnique({
          where: { clerkId },
          include: { subscription: true },
        })
      }
    } catch {
      // Webhook will catch up; render whatever the DB has.
    }
  }

  const sub = user?.subscription
  const hasPaidPlan = !!sub && sub.plan !== 'FREE' && ENTITLED.has(sub.status)
  const dateFormat = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  })

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-10">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {justCompleted && hasPaidPlan && (
        <p
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-500"
          data-testid="checkout-success"
        >
          {t('checkoutSuccess')}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">{t('currentPlan')}</CardTitle>
          {sub ? (
            <Badge variant={ENTITLED.has(sub.status) ? 'default' : 'secondary'}>
              {t(`status.${sub.status}`)}
            </Badge>
          ) : (
            <Badge variant="secondary">Free</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold">{sub && hasPaidPlan ? sub.plan : 'FREE'}</p>
            {sub?.interval && hasPaidPlan && (
              <span className="text-sm text-muted-foreground">
                {t(`interval.${sub.interval}`)}
              </span>
            )}
          </div>

          {sub && hasPaidPlan && sub.currentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              {sub.cancelAtPeriodEnd ? t('endsOn') : t('renewsOn')}{' '}
              <span className="font-medium text-foreground">
                {dateFormat.format(sub.currentPeriodEnd)}
              </span>
            </p>
          )}

          {sub?.cancelAtPeriodEnd && hasPaidPlan && (
            <p
              className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-500"
              data-testid="cancel-scheduled"
            >
              {t('cancelScheduled')}
            </p>
          )}

          {!hasPaidPlan && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('noSubscription')}</p>
              <Button asChild>
                <Link href="/#pricing">{t('viewPricing')}</Link>
              </Button>
            </div>
          )}

          {hasPaidPlan && !sub!.cancelAtPeriodEnd && sub!.externalId && (
            <CancelSubscriptionButton />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t('billingNote')}</p>
    </div>
  )
}
