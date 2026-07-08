'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Crosshair, ExternalLink, Globe2, Navigation, Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { MAP_CATEGORIES, MAP_COINS, MAP_MIN_PIN_ZOOM } from '@/config/crypto-map'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Bbox, Place } from './crypto-map'

const CryptoMap = dynamic(() => import('./crypto-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

type Regulation = {
  countryCode: string
  status: 'FRIENDLY' | 'REGULATED' | 'RESTRICTED' | 'HOSTILE' | 'UNCLEAR'
  summaryKo: string
  summaryEn: string
}
type OnlineService = {
  id: string
  name: string
  category: string
  coins: string[]
  url: string
  descKo: string
  descEn: string
}

const STATUS_COLOR: Record<Regulation['status'], string> = {
  FRIENDLY: 'text-emerald-400 border-emerald-500/40',
  REGULATED: 'text-blue-400 border-blue-500/40',
  RESTRICTED: 'text-amber-400 border-amber-500/40',
  HOSTILE: 'text-red-400 border-red-500/40',
  UNCLEAR: 'text-muted-foreground border-border',
}

const inputCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary'

export function MapApp({ locale }: { locale: string }) {
  const t = useTranslations('map')
  const lang = useLocale()

  const [coins, setCoins] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [bbox, setBbox] = useState<Bbox | null>(null)
  const [zoom, setZoom] = useState(2)
  const [selected, setSelected] = useState<Place | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [showOnline, setShowOnline] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 350)
    return () => clearTimeout(id)
  }, [q])

  const coinParam = useMemo(() => Array.from(coins).sort().join(','), [coins])
  // Round bbox to reduce query-key churn while panning.
  const bboxKey = bbox ? bbox.map((n) => n.toFixed(2)).join(',') : null
  const pinsEnabled = !!bbox && zoom >= MAP_MIN_PIN_ZOOM

  const placesQuery = useQuery<{ places: Place[]; count: number; capped: boolean; tooWide?: boolean }>({
    queryKey: ['map-places', bboxKey, coinParam, category, debouncedQ],
    enabled: pinsEnabled,
    queryFn: () => {
      const p = new URLSearchParams({ bbox: bbox!.join(',') })
      if (coinParam) p.set('coins', coinParam)
      if (category) p.set('category', category)
      if (debouncedQ) p.set('q', debouncedQ)
      return fetch(`/api/map/places?${p}`).then((r) => r.json())
    },
  })

  const regulationQuery = useQuery<{ regulations: Regulation[] }>({
    queryKey: ['map-regulation'],
    queryFn: () => fetch('/api/map/regulation').then((r) => r.json()),
    staleTime: 60 * 60_000,
  })

  const onlineQuery = useQuery<{ services: OnlineService[] }>({
    queryKey: ['map-online', coinParam, debouncedQ],
    enabled: showOnline,
    queryFn: () => {
      const p = new URLSearchParams()
      if (coinParam) p.set('coins', coinParam)
      if (debouncedQ) p.set('q', debouncedQ)
      return fetch(`/api/map/online?${p}`).then((r) => r.json())
    },
  })

  const regByCountry = useMemo(() => {
    const m = new Map<string, Regulation>()
    for (const r of regulationQuery.data?.regulations ?? []) m.set(r.countryCode, r)
    return m
  }, [regulationQuery.data])

  const places = pinsEnabled ? placesQuery.data?.places ?? [] : []

  const toggleCoin = (c: string) =>
    setCoins((prev) => {
      const next = new Set(prev)
      next.has(c) ? next.delete(c) : next.add(c)
      return next
    })

  const locateMe = () => {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError(t('geoUnavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setFlyTarget({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 14 }),
      () => setGeoError(t('geoDenied')),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  const selReg = selected?.countryCode ? regByCountry.get(selected.countryCode) : null

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2" data-testid="map-filters">
        <div className="flex flex-wrap gap-1.5">
          {MAP_COINS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCoin(c)}
              aria-pressed={coins.has(c)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                coins.has(c)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`coins.${c}`)}
            </button>
          ))}
        </div>
        <select
          className={cn(inputCls, 'h-8 w-auto')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t('allCategories')}</option>
          {MAP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(inputCls, 'h-8 pl-8')}
            placeholder={t('searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant={showOnline ? 'default' : 'secondary'}
          onClick={() => setShowOnline((v) => !v)}
        >
          <Globe2 className="mr-1 h-4 w-4" /> {t('onlineToggle')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Map */}
        <div className="relative">
          <div
            className="relative h-[600px] w-full overflow-hidden rounded-xl border"
            data-testid="map-canvas"
          >
            <CryptoMap
              places={places}
              onViewportChange={(b, z) => {
                setBbox(b)
                setZoom(z)
              }}
              onSelect={setSelected}
              flyTarget={flyTarget}
            />
            <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
              <Button
                size="sm"
                className="pointer-events-auto shadow-lg"
                onClick={locateMe}
                data-testid="map-locate"
              >
                <Crosshair className="mr-1 h-4 w-4" /> {t('nearMe')}
              </Button>
              {!pinsEnabled && (
                <span className="pointer-events-auto rounded-md bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow">
                  {t('zoomInHint')}
                </span>
              )}
              {placesQuery.data?.capped && (
                <span className="pointer-events-auto rounded-md bg-yellow-500/15 px-3 py-1.5 text-xs text-yellow-500 shadow">
                  {t('capped')}
                </span>
              )}
            </div>
          </div>
          {geoError && <p className="mt-2 text-xs text-red-400">{geoError}</p>}
          {pinsEnabled && (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="map-count">
              {t('resultCount', { count: places.length })}
            </p>
          )}
        </div>

        {/* Right column: selected place / online / legend */}
        <div className="space-y-4">
          {selected && (
            <Card data-testid="map-place-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{selected.name ?? t('unnamed')}</h3>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t('close')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.category && <Badge variant="secondary">{t(`categories.${selected.category}`)}</Badge>}
                  {selected.coins.map((c) => (
                    <Badge key={c} variant="outline">
                      {t(`coins.${c}`)}
                    </Badge>
                  ))}
                </div>
                {selected.address && (
                  <p className="text-sm text-muted-foreground">{selected.address}</p>
                )}
                {selReg && (
                  <div className="rounded-md border p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selected.countryCode}</span>
                      <Badge variant="outline" className={STATUS_COLOR[selReg.status]}>
                        {t(`status.${selReg.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lang === 'ko' ? selReg.summaryKo : selReg.summaryEn}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="mr-1 h-4 w-4" /> {t('directions')}
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showOnline && (
            <Card data-testid="map-online-list">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-medium">{t('onlineTitle')}</p>
                {(onlineQuery.data?.services ?? []).map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start justify-between gap-2 rounded-md border p-2.5 hover:border-primary/40"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{lang === 'ko' ? s.descKo : s.descEn}</p>
                    </div>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
                {onlineQuery.data && onlineQuery.data.services.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('noOnline')}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Regulation legend */}
          <Card data-testid="map-legend">
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-medium">{t('legendTitle')}</p>
              <div className="space-y-1.5">
                {(['FRIENDLY', 'REGULATED', 'RESTRICTED', 'HOSTILE', 'UNCLEAR'] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className={STATUS_COLOR[s]}>
                      {t(`status.${s}`)}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">{t('legendNote')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
