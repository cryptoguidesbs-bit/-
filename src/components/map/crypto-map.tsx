'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'

import { CATEGORY_COLOR, type MapCategory } from '@/config/crypto-map'

const colorFor = (category: string | null): string =>
  CATEGORY_COLOR[(category as MapCategory) in CATEGORY_COLOR ? (category as MapCategory) : 'other']

import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

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

function pinIcon(place: Place, selected: boolean): L.DivIcon {
  const color = colorFor(place.category)
  const ln = place.coins.includes('lightning')
  const size = selected ? 22 : 15
  const ring = selected ? '#f8fafc' : '#0a0f1c'
  return L.divIcon({
    className: 'cg-pin',
    html:
      `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;` +
      `background:${color};border:2px solid ${ring};` +
      `box-shadow:0 0 0 1.5px ${color}66${selected ? `,0 0 10px 2px ${color}` : ''}` +
      `${ln ? `;outline:2px solid #a855f7;outline-offset:1px` : ''}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Dark-themed cluster bubble, sized/tinted by child count.
function clusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount()
  const size = count < 25 ? 34 : count < 200 ? 42 : count < 1000 ? 50 : 58
  const label = count >= 1000 ? `${Math.round(count / 100) / 10}k` : String(count)
  return L.divIcon({
    html:
      `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;` +
      `border-radius:50%;background:rgba(59,130,246,0.85);border:2px solid rgba(248,250,252,0.9);` +
      `color:#04121f;font-size:12px;font-weight:700;box-shadow:0 0 0 4px rgba(59,130,246,0.25)">${label}</div>`,
    className: 'cg-cluster',
    iconSize: L.point(size, size, true),
  })
}

function ViewportWatcher({ onChange }: { onChange: (bbox: Bbox, zoom: number) => void }) {
  const map = useMapEvents({
    moveend: () => emit(),
    zoomend: () => emit(),
  })
  function emit() {
    const b = map.getBounds()
    onChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], map.getZoom())
  }
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
  selectedId,
  onViewportChange,
  onSelect,
  flyTarget,
}: {
  places: Place[]
  selectedId: string | null
  onViewportChange: (bbox: Bbox, zoom: number) => void
  onSelect: (place: Place) => void
  flyTarget: { lat: number; lng: number; zoom?: number } | null
}) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
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
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={55}
        spiderfyOnMaxZoom
        iconCreateFunction={clusterIcon}
      >
        {places.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p, p.id === selectedId)}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            {p.name && (
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                {p.name}
              </Tooltip>
            )}
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
