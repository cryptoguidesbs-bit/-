'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  ExternalLink,
  Maximize2,
  Minimize2,
  Newspaper,
  Sparkles,
  TrendingUp,
  Users,
  MapPin,
  Mail,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Operator wall-board — big numbers, traffic-light health, auto-refresh.
// Designed to sit full-screen on a monitor (or a phone) all day.

const REFRESH_MS = 60_000

type Health = 'ok' | 'warn' | 'down' | 'unknown'
type Board = {
  generatedAt: string
  users: { total: number; today: number; last7d: number }
  plans: Record<string, number>
  waitlist: { total: number; today: number }
  inquiries: { open: number }
  news: { latestAt: string | null; ageMin: number | null; pending: number; publishedToday: number; health: Health }
  brief: {
    latest: { briefDate: string; tier: string; aiModel: string; createdAt: string } | null
    tiers: string[]
    ageMin: number | null
    health: Health
  }
  alerts: { activeRules: number; sent24h: number; lastDeliveryAt: string | null; ageMin: number | null }
  map: { places: number; lastSyncAt: string | null; ageMin: number | null; health: Health }
  market: {
    prices: { id: string; price: number; changePct: number }[]
    source: string | null
    stale: boolean
    updatedAt: string | null
    fearGreed: { value: number; classification: string } | null
  }
  ai: { callsToday: number; model: string | null; mock: boolean }
  ops: { open: number; latest: { id: string; kind: string; severity: string; message: string; createdAt: string }[] }
}

const HEALTH_DOT: Record<Health, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-yellow-500',
  down: 'bg-red-500',
  unknown: 'bg-muted-foreground',
}
const HEALTH_LABEL: Record<Health, string> = {
  ok: '정상',
  warn: '지연',
  down: '중단',
  unknown: '데이터 없음',
}

const n = new Intl.NumberFormat('ko-KR')
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function ago(min: number | null): string {
  if (min === null) return '기록 없음'
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h}시간 ${min % 60}분 전`
  return `${Math.floor(h / 24)}일 전`
}

function Tile({
  title,
  icon: Icon,
  health,
  children,
  className,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  health?: Health
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('flex flex-col gap-3 rounded-2xl border bg-card/60 p-5', className)}
      data-testid={`board-tile-${title}`}
    >
      <header className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </span>
        {health && (
          <span className="flex items-center gap-1.5 text-xs">
            <span className={cn('h-2.5 w-2.5 rounded-full', HEALTH_DOT[health], health === 'ok' && 'animate-pulse')} />
            {HEALTH_LABEL[health]}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

function Big({ value, label, tone }: { value: string | number; label?: string; tone?: 'up' | 'down' | 'muted' }) {
  return (
    <div>
      <div
        className={cn(
          'text-4xl font-bold tabular-nums tracking-tight md:text-5xl',
          tone === 'up' && 'text-emerald-400',
          tone === 'down' && 'text-red-400',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </div>
      {label && <div className="mt-1 text-xs text-muted-foreground">{label}</div>}
    </div>
  )
}

export function AdminBoard() {
  const { data, dataUpdatedAt, isError } = useQuery<Board>({
    queryKey: ['adm-board'],
    queryFn: () => fetch('/api/admin/board').then((r) => r.json()),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: true,
  })

  // Live clock + fullscreen toggle for the wall-board use case.
  const [clock, setClock] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      clearInterval(id)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }

  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('ko-KR') : '—'
  const planTotal = data ? Object.values(data.plans).reduce((a, b) => a + b, 0) : 0
  const cronRows: { name: string; sched: string; ageMin: number | null; health: Health }[] = data
    ? [
        { name: '뉴스 수집·요약', sched: '30분', ageMin: data.news.ageMin, health: data.news.health },
        { name: '데일리 브리핑', sched: '07:30', ageMin: data.brief.ageMin, health: data.brief.health },
        { name: '지도 동기화', sched: '04:00', ageMin: data.map.ageMin, health: data.map.health },
        {
          name: '알림 엔진(발송 기준)',
          sched: '1분',
          ageMin: data.alerts.ageMin,
          health: data.alerts.ageMin === null ? 'unknown' : 'ok',
        },
      ]
    : []

  return (
    <div className="space-y-4" data-testid="admin-board">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">CryptoGuide 운영 보드</h1>
          <span className="text-sm text-muted-foreground tabular-nums">{clock}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            갱신 {updated} · 60초마다 자동
            {isError && <span className="ml-2 text-red-400">불러오기 실패</span>}
          </span>
          <Button asChild size="sm" variant="outline">
            <a href="https://vercel.com/crypto-guide/cryptoguide/analytics" target="_blank" rel="noreferrer">
              방문자 통계 <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={toggleFullscreen} data-testid="board-fullscreen">
            {fullscreen ? <Minimize2 className="mr-1 h-3.5 w-3.5" /> : <Maximize2 className="mr-1 h-3.5 w-3.5" />}
            {fullscreen ? '창 모드' : '전체 화면'}
          </Button>
        </div>
      </div>

      {!data ? (
        <div className="py-20 text-center text-muted-foreground">불러오는 중…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Row 1 — growth */}
          <Tile title="회원" icon={Users}>
            <Big value={n.format(data.users.total)} label={`오늘 +${data.users.today} · 7일 +${data.users.last7d}`} tone={data.users.today > 0 ? 'up' : undefined} />
          </Tile>
          <Tile title="유료 플랜" icon={TrendingUp}>
            <Big value={n.format(planTotal)} label={Object.entries(data.plans).map(([p, c]) => `${p} ${c}`).join(' · ') || '활성 구독 없음 (대기자 모드)'} />
          </Tile>
          <Tile title="대기자 신청" icon={Mail}>
            <Big value={n.format(data.waitlist.total)} label={`오늘 +${data.waitlist.today}`} tone={data.waitlist.today > 0 ? 'up' : undefined} />
          </Tile>
          <Tile title="기업 문의 (미처리)" icon={Mail}>
            <Big value={n.format(data.inquiries.open)} tone={data.inquiries.open > 0 ? 'up' : 'muted'} label={data.inquiries.open > 0 ? '답변 필요' : '없음'} />
          </Tile>

          {/* Row 2 — content pipelines */}
          <Tile title="뉴스 파이프라인" icon={Newspaper} health={data.news.health}>
            <Big value={n.format(data.news.publishedToday)} label={`오늘 발행 · 마지막 수집 ${ago(data.news.ageMin)}`} />
            <div className={cn('text-sm', data.news.pending > 0 ? 'text-yellow-500' : 'text-muted-foreground')}>
              미요약 {data.news.pending}건
            </div>
          </Tile>
          <Tile title="데일리 브리핑" icon={Sparkles} health={data.brief.health}>
            <Big value={data.brief.latest ? data.brief.latest.briefDate : '—'} label={data.brief.latest ? `${data.brief.tiers.join(' + ')} · ${ago(data.brief.ageMin)}` : '발행된 브리핑 없음'} />
          </Tile>
          <Tile title="AI 생성" icon={Bot} health={data.ai.mock ? 'warn' : 'ok'}>
            <Big value={n.format(data.ai.callsToday)} label="오늘 AI 호출 수" />
            <div className={cn('text-sm', data.ai.mock ? 'text-yellow-500' : 'text-muted-foreground')}>
              {data.ai.mock ? `목업 모드 (${data.ai.model}) — API 키 없음` : `모델 ${data.ai.model ?? '—'}`}
            </div>
          </Tile>
          <Tile title="알림 엔진" icon={Bell}>
            <Big value={n.format(data.alerts.sent24h)} label={`24시간 발송 · 활성 규칙 ${data.alerts.activeRules}개`} />
            <div className="text-sm text-muted-foreground">마지막 발송 {ago(data.alerts.ageMin)}</div>
          </Tile>

          {/* Row 3 — market + map + cron + ops */}
          <Tile title="시세 소스" icon={TrendingUp} health={data.market.prices.length ? (data.market.stale ? 'warn' : 'ok') : 'down'}>
            <div className="grid grid-cols-3 gap-2">
              {data.market.prices.map((p) => (
                <div key={p.id}>
                  <div className="text-xs text-muted-foreground">{p.id}</div>
                  <div className="text-lg font-semibold tabular-nums">{usd.format(p.price)}</div>
                  <div className={cn('text-xs tabular-nums', p.changePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {p.changePct >= 0 ? '+' : ''}
                    {p.changePct.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.market.source ?? '소스 없음'}
              {data.market.fearGreed && ` · 공포탐욕 ${data.market.fearGreed.value} (${data.market.fearGreed.classification})`}
            </div>
          </Tile>
          <Tile title="결제 지도" icon={MapPin} health={data.map.health}>
            <Big value={n.format(data.map.places)} label={`등록 장소 · 마지막 동기화 ${ago(data.map.ageMin)}`} />
          </Tile>
          <Tile title="크론 상태" icon={Activity}>
            <ul className="space-y-1.5 text-sm">
              {cronRows.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', HEALTH_DOT[c.health])} />
                    {c.name}
                    <span className="text-xs text-muted-foreground">({c.sched})</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{ago(c.ageMin)}</span>
                </li>
              ))}
            </ul>
          </Tile>
          <Tile title="운영 경보" icon={AlertTriangle} health={data.ops.open === 0 ? 'ok' : data.ops.latest.some((e) => e.severity === 'critical') ? 'down' : 'warn'}>
            <Big value={n.format(data.ops.open)} label="열린 경보" tone={data.ops.open > 0 ? 'down' : 'muted'} />
            <ul className="space-y-1 text-xs text-muted-foreground">
              {data.ops.latest.slice(0, 3).map((e) => (
                <li key={e.id} className="truncate">
                  <span className={cn('mr-1', e.severity === 'critical' ? 'text-red-400' : 'text-yellow-500')}>●</span>
                  {e.message}
                </li>
              ))}
            </ul>
          </Tile>
        </div>
      )}
    </div>
  )
}
