'use client'

import { useState } from 'react'
import { BarChart3, BookOpen, Key, Plus, Trash2, Webhook } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type ApiKeyRow = {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

type Usage = {
  total: number
  byEndpoint: Record<string, number>
  rows: { day: string; endpoint: string; count: number; apiKey: { name: string; prefix: string } }[]
}

type WebhookRow = {
  id: string
  url: string
  events: string[]
  active: boolean
  secretHint: string
  lastDeliveryAt: string | null
  lastStatus: number | null
}

const inputCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary'

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/market/prices', desc: { key: 'docsPrices' } },
  { method: 'GET', path: '/api/v1/market/sentiment', desc: { key: 'docsSentiment' } },
  { method: 'GET', path: '/api/v1/briefs/latest', desc: { key: 'docsBriefs' } },
] as const

export function ApiCenter() {
  const t = useTranslations('apiCenter')
  const queryClient = useQueryClient()

  const keysQuery = useQuery<{ keys: ApiKeyRow[] }>({
    queryKey: ['api-keys'],
    queryFn: () => fetch('/api/me/api-keys').then((r) => r.json()),
  })
  const usageQuery = useQuery<Usage>({
    queryKey: ['api-usage'],
    queryFn: () => fetch('/api/me/api-usage').then((r) => r.json()),
  })
  const webhooksQuery = useQuery<{ webhooks: WebhookRow[] }>({
    queryKey: ['api-webhooks'],
    queryFn: () => fetch('/api/me/webhooks').then((r) => r.json()),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    queryClient.invalidateQueries({ queryKey: ['api-usage'] })
    queryClient.invalidateQueries({ queryKey: ['api-webhooks'] })
  }

  // --- key creation (secret shown once) --------------------------------------
  const [keyName, setKeyName] = useState('')
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)

  const createKey = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/me/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: keyName || 'default' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'error')
      return json.key as string
    },
    onSuccess: (key) => {
      setNewSecret(key)
      setKeyError(null)
      setKeyName('')
      invalidate()
    },
    onError: (err) => setKeyError(err.message),
  })
  const revokeKey = useMutation({
    mutationFn: (id: string) => fetch(`/api/me/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  // --- webhook creation --------------------------------------------------------
  const [hookUrl, setHookUrl] = useState('')
  const [hookSecret, setHookSecret] = useState<string | null>(null)
  const [hookError, setHookError] = useState<string | null>(null)

  const createHook = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/me/webhooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: hookUrl, events: ['brief.published', 'report.published'] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'error')
      return json.secret as string
    },
    onSuccess: (secret) => {
      setHookSecret(secret)
      setHookError(null)
      setHookUrl('')
      invalidate()
    },
    onError: (err) => setHookError(err.message),
  })
  const deleteHook = useMutation({
    mutationFn: (id: string) => fetch(`/api/me/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
  const testHook = useMutation({
    mutationFn: (id: string) => fetch(`/api/me/webhooks/${id}/test`, { method: 'POST' }),
    onSuccess: invalidate,
  })

  const keys = keysQuery.data?.keys ?? []
  const usage = usageQuery.data
  const webhooks = webhooksQuery.data?.webhooks ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* API keys */}
      <Card data-testid="api-keys-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" /> {t('keys')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder={t('keyName')}
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
            <Button size="sm" disabled={createKey.isPending} onClick={() => createKey.mutate()}>
              <Plus className="mr-1 h-4 w-4" /> {t('issue')}
            </Button>
          </div>
          {newSecret && (
            <div className="space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
              <p className="text-xs font-medium text-emerald-400">{t('secretOnce')}</p>
              <code className="block overflow-x-auto text-xs" data-testid="api-key-secret">
                {newSecret}
              </code>
            </div>
          )}
          {keyError && <p className="text-xs text-red-400">{keyError}</p>}
          {keysQuery.isLoading && <Skeleton className="h-12 w-full" />}
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
              data-testid="api-key-row"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium">{k.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{k.prefix}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {k.revokedAt ? (
                  <Badge variant="outline" className="text-red-400">
                    {t('revoked')}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeKey.mutate(k.id)}
                    aria-label={t('revoke')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!keysQuery.isLoading && keys.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noKeys')}</p>
          )}
        </CardContent>
      </Card>

      {/* Usage dashboard */}
      <Card data-testid="api-usage-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> {t('usage')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usageQuery.isLoading && <Skeleton className="h-16 w-full" />}
          {usage && (
            <>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{usage.total}</p>
                <p className="text-xs text-muted-foreground">{t('total30d')}</p>
              </div>
              {Object.entries(usage.byEndpoint).map(([endpoint, count]) => (
                <div
                  key={endpoint}
                  className="flex items-center justify-between rounded-lg border p-3"
                  data-testid="api-usage-row"
                >
                  <code className="text-xs">{endpoint}</code>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
              {usage.total === 0 && (
                <p className="text-sm text-muted-foreground">{t('noUsage')}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card data-testid="api-webhooks-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> {t('webhooks')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="https://example.com/webhook"
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
            />
            <Button size="sm" disabled={createHook.isPending} onClick={() => createHook.mutate()}>
              {t('add')}
            </Button>
          </div>
          {hookSecret && (
            <div className="space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
              <p className="text-xs font-medium text-emerald-400">{t('secretOnce')}</p>
              <code className="block overflow-x-auto text-xs">{hookSecret}</code>
            </div>
          )}
          {hookError && <p className="text-xs text-red-400">{hookError}</p>}
          {webhooks.map((w) => (
            <div key={w.id} className="space-y-1.5 rounded-lg border p-3" data-testid="api-webhook-row">
              <div className="flex items-center justify-between gap-2">
                <code className="min-w-0 truncate text-xs">{w.url}</code>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="secondary" onClick={() => testHook.mutate(w.id)}>
                    {t('sendTest')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteHook.mutate(w.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {w.events.map((e) => (
                  <Badge key={e} variant="outline">
                    {e}
                  </Badge>
                ))}
                {w.lastStatus != null && <span>HTTP {w.lastStatus}</span>}
              </div>
            </div>
          ))}
          {!webhooksQuery.isLoading && webhooks.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noWebhooks')}</p>
          )}
          <p className="text-xs text-muted-foreground">{t('webhookSigning')}</p>
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card data-testid="api-docs-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> {t('docs')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="space-y-1 rounded-lg border p-3" data-testid="api-doc-row">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{e.method}</Badge>
                <code className="text-xs">{e.path}</code>
              </div>
              <p className="text-xs text-muted-foreground">{t(e.desc.key)}</p>
            </div>
          ))}
          <div className="space-y-1 rounded-lg border p-3">
            <p className="text-xs font-medium">{t('authExample')}</p>
            <code className="block overflow-x-auto whitespace-pre text-xs text-muted-foreground">
              {`curl -H "Authorization: Bearer cg_live_..." \\\n  ${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/market/prices`}
            </code>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('rateLimitNote')}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('metaNote')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
