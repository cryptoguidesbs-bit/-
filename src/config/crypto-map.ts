// Crypto Map taxonomy — coin types and place categories used across filters,
// the BTCMap parser, and the UI. Kept small on purpose.

export const MAP_COINS = ['btc', 'lightning', 'eth', 'usdt', 'usdc'] as const
export type MapCoin = (typeof MAP_COINS)[number]

export const MAP_CATEGORIES = [
  'cafe',
  'restaurant',
  'bar',
  'grocery',
  'shop',
  'atm',
  'lodging',
  'service',
  'other',
] as const
export type MapCategory = (typeof MAP_CATEGORIES)[number]

// Category → pin color. Lives here (not in the Leaflet component) so the
// legend can import it without pulling Leaflet into the server bundle.
export const CATEGORY_COLOR: Record<MapCategory, string> = {
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

// Viewport query guardrails (see CRYPTO_MAP_PLAN.md §10). Clustering
// (react-leaflet-cluster) renders these efficiently, so the cap is generous
// and pins/clusters appear from a low zoom.
export const MAP_PLACES_LIMIT = 1500
// Below this zoom the client shows a "zoom in" hint instead of loading pins.
export const MAP_MIN_PIN_ZOOM = 5

// Map an OSM/BTCMap tag set to one of our coarse categories.
export function categorizeOsm(tags: Record<string, string> | undefined): MapCategory {
  if (!tags) return 'other'
  if (tags.amenity === 'atm' || tags['currency:XBT']) {
    if (tags.amenity === 'atm') return 'atm'
  }
  const amenity = tags.amenity
  const shop = tags.shop
  const tourism = tags.tourism
  if (amenity === 'atm') return 'atm'
  if (amenity === 'cafe') return 'cafe'
  if (amenity === 'restaurant' || amenity === 'fast_food') return 'restaurant'
  if (amenity === 'bar' || amenity === 'pub' || amenity === 'nightclub') return 'bar'
  if (tourism === 'hotel' || tourism === 'guest_house' || tourism === 'hostel') return 'lodging'
  if (shop === 'supermarket' || shop === 'convenience' || shop === 'grocery') return 'grocery'
  if (shop) return 'shop'
  if (amenity) return 'service'
  return 'other'
}
