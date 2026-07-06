import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { Globe, Info } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { checkFeature } from '@/lib/entitlements'
import { ReferralCenter } from '@/components/referral/referral-center'
import { UpgradeRequired } from '@/components/entitlements/upgrade-required'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'referral' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: pageAlternates('/referral', locale),
  }
}

// Referral program — open to every signed-in member (growth funnel).
// Monetary rewards are region-gated: in non-whitelisted countries the
// program (link/ranking) still works but no commission accrues.
export default async function ReferralPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  const { userId } = await auth()
  const gate = await checkFeature('referral.program')
  if (!userId) {
    return <UpgradeRequired gate={{ ...gate, allowed: false, reason: 'auth' }} />
  }

  const rewardsGate = await checkFeature('referral.rewards')
  const t = await getTranslations({ locale, namespace: 'referral' })

  return (
    <div className="space-y-6 py-6" data-testid="referral-page">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Program terms disclaimer — always visible */}
      <p
        data-testid="referral-disclaimer"
        className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-500"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {t('disclaimer')}
      </p>

      {/* Region policy: monetary rewards unavailable in this country */}
      {!rewardsGate.allowed && (
        <p
          data-testid="referral-rewards-region-blocked"
          className="flex items-start gap-2 rounded-lg border p-4 text-sm leading-relaxed text-muted-foreground"
        >
          <Globe className="mt-0.5 h-4 w-4 shrink-0" />
          {t('regionBlocked')}
        </p>
      )}

      <ReferralCenter rewardsAllowed={rewardsGate.allowed} />
    </div>
  )
}
