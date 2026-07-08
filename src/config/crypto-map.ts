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

// Viewport query guardrails (see CRYPTO_MAP_PLAN.md §10).
export const MAP_PLACES_LIMIT = 500
// Below this zoom the client shows the regulation layer instead of pins.
export const MAP_MIN_PIN_ZOOM = 9

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
