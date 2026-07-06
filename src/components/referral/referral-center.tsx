'use client'

import { useState } from 'react'
import { Check, Copy, Gift, Trophy, Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type ReferralMe = {
  code: string
  link: string
  clicks: number
  stats: { pending: number; qualified: number }
  rewardsAllowed: boolean
  rewards: {
    id: string
    amountUsd: number
    status: 'PENDING' | 'APPROVED' | 'PAID' | 'VOID'
    note: string | null
    createdAt: string
  }[]
}

type Leaderboard = { leaderboard: { rank: number; name: string; qualified: number }[] }

export function ReferralCenter({ rewardsAllowed }: { rewardsAllowed: boolean }) {
  const t = useTranslations('referral')
  const [copied, setCopied] = useState(false)

  const meQuery = useQuery<ReferralMe>({
    queryKey: ['referral-me'],
    queryFn: () => fetch('/api/me/referral').then((r) => r.json()),
  })
  const boardQuery = useQuery<Leaderboard>({
    queryKey: ['referral-leaderboard'],
    queryFn: () => fetch('/api/referral/leaderboard').then((r) => r.json()),
  })

  const me = meQuery.data

  const copy = async () => {
    if (!me?.link) return
    await navigator.clipboard.writeText(me.link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* My link + stats */}
      <Card data-testid="referral-link-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> {t('myLink')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {meQuery.isLoading && <Skeleton className="h-9 w-full" />}
          {me && (
            <>
              <div className="flex gap-2">
                <code
                  data-testid="referral-link"
                  className="flex h-9 min-w-0 flex-1 items-center overflow-x-auto rounded-md border bg-secondary px-3 text-xs"
                >
                  {me.link}
                </code>
                <Button size="sm" variant="secondary" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold">{me.clicks}</p>
                  <p className="text-xs text-muted-foreground">{t('clicks')}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold">{me.stats.pending}</p>
                  <p className="text-xs text-muted-foreground">{t('pending')}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold">{me.stats.qualified}</p>
                  <p className="text-xs text-muted-foreground">{t('qualified')}</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{t('howItWorks')}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Rewards ledger */}
      <Card data-testid="referral-rewards">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4" /> {t('rewards')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!rewardsAllowed && (
            <p className="text-sm text-muted-foreground">{t('rewardsUnavailable')}</p>
          )}
          {rewardsAllowed && meQuery.isLoading && <Skeleton className="h-16 w-full" />}
          {rewardsAllowed && me && me.rewards.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noRewards')}</p>
          )}
          {rewardsAllowed &&
            me?.rewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border p-3"
                data-testid="referral-reward-row"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">${r.amountUsd.toFixed(2)}</p>
                  {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                </div>
                <Badge variant={r.status === 'PAID' ? 'secondary' : 'outline'}>
                  {t(`rewardStatus.${r.status}`)}
                </Badge>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="lg:col-span-2" data-testid="referral-leaderboard">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" /> {t('leaderboard')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {boardQuery.isLoading && <Skeleton className="h-16 w-full" />}
          {boardQuery.data?.leaderboard.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noLeaders')}</p>
          )}
          {boardQuery.data?.leaderboard.map((row) => (
            <div
              key={row.rank}
              className="flex items-center justify-between rounded-lg border p-3"
              data-testid="referral-leader-row"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                  {row.rank}
                </span>
                <span className="text-sm font-medium">{row.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {t('qualifiedCount', { count: row.qualified })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
