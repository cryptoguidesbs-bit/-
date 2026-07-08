'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

import 'leaflet/dist/leaflet.css'

export type Place = {
  id: string
  name: string | null
  lat: number
  lng: number
  category: string | null
  coins: string[]
  address: string | null
  countryCode: string | null
  verifiedAt: string | null
}

export type Bbox = [number, number, number, number] // minLng,minLat,maxLng,maxLat

const COLOR: Record<string, string> = {
  atm: '#f59e0b',
  cafe: '#22c55e',
  restaurant: '#ef4444',
  bar: '#a855f7',
  grocery: '#14b8a6',
  lodging: '#3b82f6',
  shop: '#0ea5e9',
  service: '#64748b',
  other: '#94a3b8',
}

function pinIcon(place: Place): L.DivIcon {
  const color = COLOR[place.category ?? 'other'] ?? COLOR.other
  const ln = place.coins.includes('lightning')
  return L.divIcon({
    className: 'cg-pin',
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #0a0f1c;box-shadow:0 0 0 1.5px ${color}66${ln ? ';outline:2px solid #a855f7;outline-offset:1px' : ''}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function ViewportWatcher({ onChange }: { onChange: (bbox: Bbox, zoom: number) => void }) {
  const map = useMapEvents({
    moveend: () => emit(),
    zoomend: () => emit(),
  })
  function emit() {
    const b = map.getBounds()
    onChange(
      [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      map.getZoom(),
    )
  }
  // Emit once on mount so the initial viewport loads.
  useEffect(() => {
    emit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function FlyTo({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom ?? 14, { duration: 1 })
  }, [target, map])
  return null
}

export default function CryptoMap({
  places,
  onViewportChange,
  onSelect,
  flyTarget,
}: {
  places: Place[]
  onViewportChange: (bbox: Bbox, zoom: number) => void
  onSelect: (place: Place) => void
  flyTarget: { lat: number; lng: number; zoom?: number } | null
}) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      scrollWheelZoom
      style={{ height: '100%', width: '100%', background: '#0a0f1c' }}
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &middot; merchant data &copy; <a href="https://btcmap.org">BTCMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ViewportWatcher onChange={onViewportChange} />
      <FlyTo target={flyTarget} />
      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pinIcon(p)}
          eventHandlers={{ click: () => onSelect(p) }}
        />
      ))}
    </MapContainer>
  )
}
