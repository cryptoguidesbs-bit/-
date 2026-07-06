'use client'

import { useState } from 'react'
import { Bell, Plus, Send, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type AlertType = 'PRICE' | 'WHALE' | 'PATTERN' | 'MACRO'
type AlertChannel = 'INAPP' | 'TELEGRAM' | 'EMAIL' | 'PUSH'

type Rule = {
  id: string
  type: AlertType
  channel: AlertChannel
  params: Record<string, unknown>
  active: boolean
  lastFiredAt: string | null
}

type Delivery = {
  id: string
  type: AlertType
  channel: AlertChannel
  title: string
  body: string
  status: 'SENT' | 'FAILED' | 'SKIPPED'
  transport: string | null
  createdAt: string
}

type ChannelConfig = { channel: AlertChannel; config: Record<string, unknown> }

const inputCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary'

function describeParams(rule: Rule): string {
  const p = rule.params
  switch (rule.type) {
    case 'PRICE':
      return `${p.symbol} ${p.direction === 'above' ? '≥' : '≤'} $${Number(p.threshold).toLocaleString()}`
    case 'WHALE':
      return `≥ $${Number(p.minUsd).toLocaleString()}`
    case 'PATTERN':
      return `${p.symbol} · ${p.interval} · ≥ ${p.minConfidence}%`
    case 'MACRO':
      return `≤ ${p.low} / ≥ ${p.high}`
  }
}

export function AlertCenter() {
  const t = useTranslations('alerts')
  const queryClient = useQueryClient()

  const rulesQuery = useQuery<{ rules: Rule[] }>({
    queryKey: ['alert-rules'],
    queryFn: () => fetch('/api/me/alerts').then((r) => r.json()),
  })
  const deliveriesQuery = useQuery<{ deliveries: Delivery[] }>({
    queryKey: ['alert-deliveries'],
    queryFn: () => fetch('/api/me/alerts/deliveries').then((r) => r.json()),
  })
  const channelsQuery = useQuery<{ channels: ChannelConfig[] }>({
    queryKey: ['alert-channels'],
    queryFn: () => fetch('/api/me/alerts/channels').then((r) => r.json()),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
    queryClient.invalidateQueries({ queryKey: ['alert-channels'] })
  }

  // --- rule creation form ---------------------------------------------------
  const [type, setType] = useState<AlertType>('PRICE')
  const [channel, setChannel] = useState<AlertChannel>('INAPP')
  const [form, setForm] = useState<Record<string, string>>({
    symbol: 'BTC',
    direction: 'above',
    threshold: '',
    minUsd: '1000000',
    interval: '4h',
    minConfidence: '60',
    low: '20',
    high: '80',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const paramsForType = (): Record<string, unknown> => {
    switch (type) {
      case 'PRICE':
        return { symbol: form.symbol, direction: form.direction, threshold: Number(form.threshold) }
      case 'WHALE':
        return { minUsd: Number(form.minUsd) }
      case 'PATTERN':
        return {
          symbol: ['BTC', 'ETH', 'SOL'].includes(form.symbol) ? form.symbol : 'BTC',
          interval: form.interval,
          minConfidence: Number(form.minConfidence),
        }
      case 'MACRO':
        return { low: Number(form.low), high: Number(form.high) }
    }
  }

  const createRule = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/me/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, channel, params: paramsForType() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'error')
    },
    onSuccess: () => {
      setFormError(null)
      invalidate()
    },
    onError: (err) => setFormError(err.message),
  })

  const toggleRule = useMutation({
    mutationFn: (rule: Rule) =>
      fetch(`/api/me/alerts/${rule.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      }),
    onSuccess: invalidate,
  })
  const deleteRule = useMutation({
    mutationFn: (id: string) => fetch(`/api/me/alerts/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  // --- channel configs --------------------------------------------------------
  const [telegramChatId, setTelegramChatId] = useState('')
  const [emailAddress, setEmailAddress] = useState('')
  const [channelError, setChannelError] = useState<string | null>(null)

  const saveChannel = useMutation({
    mutationFn: async (payload: { channel: AlertChannel; config: Record<string, unknown> }) => {
      const res = await fetch('/api/me/alerts/channels', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'error')
    },
    onSuccess: () => {
      setChannelError(null)
      invalidate()
    },
    onError: (err) => setChannelError(err.message),
  })

  const configured = (ch: AlertChannel) =>
    (channelsQuery.data?.channels ?? []).some((c) => c.channel === ch)

  const rules = rulesQuery.data?.rules ?? []
  const deliveries = deliveriesQuery.data?.deliveries ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* New rule */}
      <Card data-testid="alert-create">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> {t('newRule')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              {t('typeLabel')}
              <select
                className={inputCls}
                value={type}
                onChange={(e) => setType(e.target.value as AlertType)}
              >
                {(['PRICE', 'WHALE', 'PATTERN', 'MACRO'] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`types.${v}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              {t('channelLabel')}
              <select
                className={inputCls}
                value={channel}
                onChange={(e) => setChannel(e.target.value as AlertChannel)}
              >
                {(['INAPP', 'TELEGRAM', 'EMAIL', 'PUSH'] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`channels.${v}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {type === 'PRICE' && (
            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('fields.symbol')}
                <input
                  className={inputCls}
                  value={form.symbol}
                  onChange={(e) => set('symbol', e.target.value.toUpperCase())}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('fields.direction')}
                <select
                  className={inputCls}
                  value={form.direction}
                  onChange={(e) => set('direction', e.target.value)}
                >
                  <option value="above">{t('fields.above')}</option>
                  <option value="below">{t('fields.below')}</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('fields.threshold')}
                <input
                  className={inputCls}
                  type="number"
                  value={form.threshold}
                  onChange={(e) => set('threshold', e.target.value)}
                />
              </label>
            </div>
          )}
          {type === 'WHALE' && (
            <label className="block space-y-1 text-xs text-muted-foreground">
              {t('fields.minUsd')}
              <input
                className={inputCls}
                type="number"
                value={form.minUsd}
                onChange={(e) => set('minUsd', e.target.value)}
              />
            </label>
          )}
          {type === 'PATTERN' && (
            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('fields.symbol')}
                <select
                  className={inputCls}
                  value={form.symbol}
                  onChange={(e) => set('symbol', e.target.value)}
                >
                  {['BTC', 'ETH', 'SOL'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('fields.interval')}
                <select
                  className={inputCls}
                  value={form.interval}
                  onChange={(e) => set('interval', e.target.value)}
                >
                  {['1h', '4h', '1d'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('fields.minConfidence')}
                <input
                  className={inputCls}
                  type="number"
                  value={form.minConfidence}
                  onChange={(e) => set('minConfidence', e.target.value)}
                />
              </label>
            </div>
          )}
          {type === 'MACRO' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('fields.low')}
                <input
                  className={inputCls}
                  type="number"
                  value={form.low}
                  onChange={(e) => set('low', e.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('fields.high')}
                <input
                  className={inputCls}
                  type="number"
                  value={form.high}
                  onChange={(e) => set('high', e.target.value)}
                />
              </label>
            </div>
          )}

          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <Button
            size="sm"
            disabled={createRule.isPending}
            onClick={() => createRule.mutate()}
            data-testid="alert-create-submit"
          >
            {t('create')}
          </Button>
        </CardContent>
      </Card>

      {/* Channel configs */}
      <Card data-testid="alert-channels">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" /> {t('channelSettings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{t('channels.TELEGRAM')}</span>
              {configured('TELEGRAM') && <Badge variant="secondary">{t('configured')}</Badge>}
            </div>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder={t('fields.telegramChatId')}
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => saveChannel.mutate({ channel: 'TELEGRAM', config: { chatId: telegramChatId } })}
              >
                {t('save')}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{t('channels.EMAIL')}</span>
              {configured('EMAIL') && <Badge variant="secondary">{t('configured')}</Badge>}
            </div>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder={t('fields.emailAddress')}
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => saveChannel.mutate({ channel: 'EMAIL', config: { address: emailAddress } })}
              >
                {t('save')}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('pushHint')}</p>
          {channelError && <p className="text-xs text-red-400">{channelError}</p>}
        </CardContent>
      </Card>

      {/* Rules list */}
      <Card data-testid="alert-rules">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> {t('myRules')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rulesQuery.isLoading && <Skeleton className="h-16 w-full" />}
          {!rulesQuery.isLoading && rules.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noRules')}</p>
          )}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
              data-testid="alert-rule-row"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t(`types.${rule.type}`)}</Badge>
                  <Badge variant="outline">{t(`channels.${rule.channel}`)}</Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{describeParams(rule)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleRule.mutate(rule)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    rule.active ? 'border-emerald-500/40 text-emerald-400' : 'text-muted-foreground',
                  )}
                >
                  {rule.active ? t('active') : t('paused')}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteRule.mutate(rule.id)}
                  aria-label={t('delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Delivery history */}
      <Card data-testid="alert-history">
        <CardHeader>
          <CardTitle className="text-base">{t('history')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {deliveriesQuery.isLoading && <Skeleton className="h-16 w-full" />}
          {!deliveriesQuery.isLoading && deliveries.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
          )}
          {deliveries.slice(0, 12).map((d) => (
            <div key={d.id} className="space-y-1 rounded-lg border p-3" data-testid="alert-delivery-row">
              <div className="flex items-center gap-2">
                <Badge
                  variant={d.status === 'SENT' ? 'secondary' : 'outline'}
                  className={cn(d.status === 'FAILED' && 'text-red-400')}
                >
                  {t(`status.${d.status}`)}
                </Badge>
                <Badge variant="outline">{t(`channels.${d.channel}`)}</Badge>
                {d.transport === 'dev' && <Badge variant="outline">{t('devTransport')}</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-medium">{d.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{d.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
