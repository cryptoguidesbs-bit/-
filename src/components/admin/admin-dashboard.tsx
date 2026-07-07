'use client'

import { useState } from 'react'
import {
  Activity,
  Bell,
  DollarSign,
  Globe2,
  Megaphone,
  Play,
  ScrollText,
  Users,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const inputCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary'

const json = (r: Response) => r.json()

export function AdminDashboard() {
  const queryClient = useQueryClient()
  const invalidateAll = () => queryClient.invalidateQueries()

  const analytics = useQuery({ queryKey: ['adm-analytics'], queryFn: () => fetch('/api/admin/analytics').then(json) })
  const revenue = useQuery({ queryKey: ['adm-revenue'], queryFn: () => fetch('/api/admin/revenue').then(json) })
  const opsEvents = useQuery({ queryKey: ['adm-ops'], queryFn: () => fetch('/api/admin/ops-events').then(json) })
  const pipelines = useQuery({ queryKey: ['adm-pipelines'], queryFn: () => fetch('/api/admin/pipelines').then(json) })
  const switches = useQuery({ queryKey: ['adm-switches'], queryFn: () => fetch('/api/admin/region-switches').then(json) })
  const errors = useQuery({ queryKey: ['adm-errors'], queryFn: () => fetch('/api/admin/errors').then(json) })

  // --- members ---------------------------------------------------------------
  const [memberQ, setMemberQ] = useState('')
  const members = useQuery({
    queryKey: ['adm-members', memberQ],
    queryFn: () => fetch(`/api/admin/members?q=${encodeURIComponent(memberQ)}`).then(json),
  })
  const patchMember = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, string> }) =>
      fetch(`/api/admin/members/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: invalidateAll,
  })

  // --- logs --------------------------------------------------------------------
  const [logType, setLogType] = useState<'audit' | 'consent'>('audit')
  const logs = useQuery({
    queryKey: ['adm-logs', logType],
    queryFn: () => fetch(`/api/admin/logs?type=${logType}&take=20`).then(json),
  })

  // --- actions -------------------------------------------------------------------
  const runMonitor = useMutation({
    mutationFn: () => fetch('/api/admin/monitor/run', { method: 'POST' }).then(json),
    onSuccess: invalidateAll,
  })
  const resolveEvent = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/ops-events/${id}`, { method: 'PATCH' }),
    onSuccess: invalidateAll,
  })
  const trigger = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) =>
      fetch(path, {
        method: 'POST',
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      }).then(json),
    onSuccess: invalidateAll,
  })

  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceResult, setAnnounceResult] = useState<string | null>(null)
  const announce = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/announce', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: announceTitle, body: announceBody || undefined }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'error')
      return j.sent as number
    },
    onSuccess: (sent) => {
      setAnnounceResult(`${sent}명에게 발송됨`)
      setAnnounceTitle('')
      setAnnounceBody('')
    },
    onError: (e) => setAnnounceResult(e.message),
  })

  const [switchFeature, setSwitchFeature] = useState('onchain.advanced')
  const [switchWhitelist, setSwitchWhitelist] = useState('')
  const putSwitch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/admin/region-switches', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: invalidateAll,
  })
  const deleteSwitch = useMutation({
    mutationFn: (feature: string) =>
      fetch('/api/admin/region-switches', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feature }),
      }),
    onSuccess: invalidateAll,
  })

  const a = analytics.data
  const rev = revenue.data
  const events = opsEvents.data?.events ?? []
  const pipe = pipelines.data

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Overview */}
      <Card data-testid="admin-overview">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.isLoading && <Skeleton className="h-16 w-full" />}
          {a && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{a.users.total}</p>
                <p className="text-xs text-muted-foreground">전체 회원</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{a.users.signups7d}</p>
                <p className="text-xs text-muted-foreground">7일 가입</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{a.api.calls30d}</p>
                <p className="text-xs text-muted-foreground">API 호출 30일</p>
              </div>
            </div>
          )}
          {rev && (
            <div className="space-y-1 rounded-lg border p-3" data-testid="admin-revenue">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4" /> 매출 (USD)
              </div>
              <p className="text-xs text-muted-foreground">
                MRR 추정 ${rev.mrrEstimate.totalUsd.toLocaleString()} · 실적{' '}
                ${rev.actuals.totalUsd.toLocaleString()} (카드 ${rev.actuals.byMethod.card} ·
                USDC ${rev.actuals.byMethod.usdc}) · 출처 {rev.source}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              미해결 이상 징후 {a?.openOpsEvents ?? '—'}건
            </p>
            <Button size="sm" onClick={() => runMonitor.mutate()} disabled={runMonitor.isPending}>
              <Play className="mr-1 h-4 w-4" /> 모니터 실행
            </Button>
          </div>
          {events.map(
            (e: { id: string; kind: string; severity: string; message: string; resolvedAt: string | null }) => (
              <div
                key={e.id}
                className="flex items-start justify-between gap-2 rounded-lg border p-3"
                data-testid="admin-ops-event"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(e.severity === 'critical' ? 'text-red-400' : 'text-yellow-500')}
                    >
                      {e.severity}
                    </Badge>
                    <code className="text-xs">{e.kind}</code>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.message}</p>
                </div>
                {!e.resolvedAt ? (
                  <Button size="sm" variant="secondary" onClick={() => resolveEvent.mutate(e.id)}>
                    해결
                  </Button>
                ) : (
                  <Badge variant="secondary">해결됨</Badge>
                )}
              </div>
            ),
          )}
        </CardContent>
      </Card>

      {/* Pipelines */}
      <Card data-testid="admin-pipelines">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4" /> 발행 파이프라인
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pipelines.isLoading && <Skeleton className="h-16 w-full" />}
          {pipe && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between rounded-lg border p-3">
                <span>뉴스 (대기 {pipe.news.pending} · 보류 {pipe.news.held})</span>
                <span className="text-xs text-muted-foreground">
                  {pipe.news.latestAt ? new Date(pipe.news.latestAt).toLocaleString() : '없음'}
                </span>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span>브리핑 {pipe.brief ? `${pipe.brief.briefDate} (${pipe.brief.tier})` : '없음'}</span>
                <span>리포트 {pipe.report ? pipe.report.periodKey : '없음'}</span>
              </div>
              <p className="text-xs text-muted-foreground">오늘 AI 호출 {pipe.ai.callsToday}건</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => trigger.mutate({ path: '/api/news/ingest' })}>
              뉴스 수집
            </Button>
            <Button size="sm" variant="secondary" onClick={() => trigger.mutate({ path: '/api/news/summarize' })}>
              뉴스 요약
            </Button>
            <Button size="sm" variant="secondary" onClick={() => trigger.mutate({ path: '/api/brief/generate' })}>
              브리핑 생성
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => trigger.mutate({ path: '/api/reports/generate', body: { cadence: 'WEEKLY' } })}
            >
              주간 리포트
            </Button>
            <Button size="sm" variant="secondary" onClick={() => trigger.mutate({ path: '/api/alerts/run' })}>
              알림 엔진
            </Button>
            <Button size="sm" variant="secondary" onClick={() => trigger.mutate({ path: '/api/referral/qualify' })}>
              리퍼럴 정산
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card data-testid="admin-members">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> 회원 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className={inputCls}
            placeholder="이메일/이름 검색"
            value={memberQ}
            onChange={(e) => setMemberQ(e.target.value)}
          />
          {members.isLoading && <Skeleton className="h-16 w-full" />}
          {(members.data?.members ?? []).slice(0, 8).map(
            (m: {
              id: string
              email: string
              role: string
              country: string | null
              subscription: { plan: string; status: string } | null
            }) => (
              <div key={m.id} className="space-y-1.5 rounded-lg border p-3" data-testid="admin-member-row">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm">{m.email}</p>
                  <div className="flex shrink-0 gap-1">
                    <Badge variant="secondary">{m.subscription?.plan ?? 'FREE'}</Badge>
                    {m.role === 'ADMIN' && <Badge variant="outline">ADMIN</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    className={cn(inputCls, 'h-8')}
                    value={m.subscription?.plan ?? 'FREE'}
                    onChange={(e) => patchMember.mutate({ id: m.id, body: { plan: e.target.value } })}
                  >
                    {['FREE', 'STANDARD', 'PROFESSIONAL', 'INSTITUTIONAL', 'LEGENDARY'].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    className={cn(inputCls, 'h-8')}
                    value={m.role}
                    onChange={(e) => patchMember.mutate({ id: m.id, body: { role: e.target.value } })}
                  >
                    {['USER', 'ADMIN'].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      {/* Region switches */}
      <Card data-testid="admin-region-switches">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="h-4 w-4" /> 지역별 서비스 스위치
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            규제 변화 시 즉시 반영됩니다 (배포 불필요). OFF는 전 지역 차단, 화이트리스트는 해당
            국가만 허용.
          </p>
          <div className="flex gap-2">
            <select
              className={inputCls}
              value={switchFeature}
              onChange={(e) => setSwitchFeature(e.target.value)}
            >
              {(switches.data?.features ?? []).map((f: { feature: string }) => (
                <option key={f.feature}>{f.feature}</option>
              ))}
            </select>
            <input
              className={inputCls}
              placeholder="화이트리스트 (예: KR,US)"
              value={switchWhitelist}
              onChange={(e) => setSwitchWhitelist(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                putSwitch.mutate({
                  feature: switchFeature,
                  enabled: true,
                  whitelist: switchWhitelist
                    .split(',')
                    .map((s) => s.trim().toUpperCase())
                    .filter((s) => s.length === 2),
                })
              }
            >
              화이트리스트 적용
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => putSwitch.mutate({ feature: switchFeature, enabled: false })}
            >
              전 지역 OFF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => deleteSwitch.mutate(switchFeature)}>
              기본 정책으로
            </Button>
          </div>
          {(switches.data?.features ?? [])
            .filter((f: { override: unknown }) => f.override)
            .map((f: { feature: string; override: { enabled: boolean; whitelist: string[] } }) => (
              <div
                key={f.feature}
                className="flex items-center justify-between rounded-lg border p-3"
                data-testid="admin-switch-row"
              >
                <code className="text-xs">{f.feature}</code>
                <Badge variant={f.override.enabled ? 'secondary' : 'outline'} className={cn(!f.override.enabled && 'text-red-400')}>
                  {f.override.enabled
                    ? f.override.whitelist.length > 0
                      ? f.override.whitelist.join(',')
                      : 'ON'
                    : 'OFF'}
                </Badge>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Announce */}
      <Card data-testid="admin-announce">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" /> 공지 발송
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            className={inputCls}
            placeholder="공지 제목"
            value={announceTitle}
            onChange={(e) => setAnnounceTitle(e.target.value)}
          />
          <textarea
            className={cn(inputCls, 'h-20 py-2')}
            placeholder="내용 (선택)"
            value={announceBody}
            onChange={(e) => setAnnounceBody(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => announce.mutate()} disabled={announce.isPending}>
              <Bell className="mr-1 h-4 w-4" /> 전체 발송
            </Button>
            {announceResult && <p className="text-xs text-muted-foreground">{announceResult}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Logs + errors */}
      <Card data-testid="admin-logs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" /> 로그 · 에러
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {(['audit', 'consent'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLogType(t)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium',
                  logType === t ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground',
                )}
              >
                {t === 'audit' ? 'ContentAuditLog' : 'ConsentLog'}
              </button>
            ))}
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {(logs.data?.rows ?? []).map(
              (row: Record<string, unknown> & { id: string; createdAt: string }) => (
                <div key={row.id} className="rounded-lg border p-2 text-xs" data-testid="admin-log-row">
                  {logType === 'audit' ? (
                    <span>
                      <b>{String(row.action)}</b> {String(row.contentType)} ·{' '}
                      {String(row.reason ?? '')}
                    </span>
                  ) : (
                    <span>
                      <b>{(row.user as { email?: string })?.email}</b> {String(row.type)} v
                      {String(row.version)} · IP {String(row.ipAddress ?? '—')}
                    </span>
                  )}
                  <span className="float-right text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
              ),
            )}
          </div>
          <div className="rounded-lg border p-3 text-xs text-muted-foreground" data-testid="admin-errors">
            Sentry: {errors.data?.source ?? '…'} · 미해결 이슈 {errors.data?.issues?.length ?? 0}건
            {errors.data?.source === 'unconfigured' && ' (SENTRY_AUTH_TOKEN 미설정 — 배포 시 연결)'}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
