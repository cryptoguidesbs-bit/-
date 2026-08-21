// Symbols shown in the live ticker and the market dashboard.
// Live updates come from Binance public WebSocket miniTicker streams;
// the initial snapshot comes from /api/market/tickers (REST proxy).
export type MarketSymbol = {
  symbol: string
  base: string
  name: string
  coingeckoId: string
  paprikaId: string
}

export const marketSymbols: MarketSymbol[] = [
  { symbol: 'BTCUSDT', base: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin', paprikaId: 'btc-bitcoin' },
  { symbol: 'ETHUSDT', base: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum', paprikaId: 'eth-ethereum' },
  { symbol: 'SOLUSDT', base: 'SOL', name: 'Solana', coingeckoId: 'solana', paprikaId: 'sol-solana' },
  { symbol: 'BNBUSDT', base: 'BNB', name: 'BNB', coingeckoId: 'binancecoin', paprikaId: 'bnb-binance-coin' },
  { symbol: 'XRPUSDT', base: 'XRP', name: 'XRP', coingeckoId: 'ripple', paprikaId: 'xrp-xrp' },
  { symbol: 'ADAUSDT', base: 'ADA', name: 'Cardano', coingeckoId: 'cardano', paprikaId: 'ada-cardano' },
  { symbol: 'DOGEUSDT', base: 'DOGE', name: 'Dogecoin', coingeckoId: 'dogecoin', paprikaId: 'doge-dogecoin' },
  { symbol: 'AVAXUSDT', base: 'AVAX', name: 'Avalanche', coingeckoId: 'avalanche-2', paprikaId: 'avax-avalanche' },
]

export const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream'
export const BINANCE_REST_URL = 'https://api.binance.com/api/v3'
