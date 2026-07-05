import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Briefcase, Sparkles } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  NotificationsCard,
  SavedArticlesCard,
  SavedReportsCard,
  WatchlistCard,
} from '@/components/dashboard/dashboard-widgets'
import { Link } from '@/i18n/navigation'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  return { title: t('title') }
}

export default async function DashboardPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  const { userId: clerkId } = await auth()
  if (!clerkId) redirect(`/${locale}/sign-in`)

  const t = await getTranslations({ locale, namespace: 'dashboard' })
  const portfolioGate = await checkFeature('portfolio.tools')

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: true },
  })
  const plan =
    user?.subscription &&
    ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(user.subscription.status) &&
    user.subscription.plan !== 'FREE'
      ? user.subscription.plan
      : 'FREE'

  return (
    <div className="space-y-6 py-6" data-testid="dashboard-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {user?.name ? t('greetingNamed', { name: user.name }) : t('greeting')}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {plan}
        </Badge>
      </div>

      {/* Portfolio quick access */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">{t('portfolio.title')}</p>
              <p className="text-sm text-muted-foreground">
                {portfolioGate.allowed ? t('portfolio.open') : t('portfolio.locked')}
              </p>
            </div>
          </div>
          {portfolioGate.allowed ? (
            <Button asChild size="sm">
              <Link href="/portfolio">{t('portfolio.cta')}</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/#pricing">
                <Sparkles className="mr-1.5 h-4 w-4" />
                {t('portfolio.upgrade')}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <WatchlistCard />
        <NotificationsCard />
        <SavedArticlesCard />
        <SavedReportsCard />
      </div>
    </div>
  )
}
