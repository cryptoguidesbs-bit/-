// Symbols shown in the live ticker and the market dashboard.
// Live updates come from Binance public WebSocket miniTicker streams;
// the initial snapshot comes from /api/market/tickers (REST proxy).
export type MarketSymbol = {
  symbol: string
  base: string
  name: string
}

export const marketSymbols: MarketSymbol[] = [
  { symbol: 'BTCUSDT', base: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', base: 'ETH', name: 'Ethereum' },
  { symbol: 'SOLUSDT', base: 'SOL', name: 'Solana' },
  { symbol: 'BNBUSDT', base: 'BNB', name: 'BNB' },
  { symbol: 'XRPUSDT', base: 'XRP', name: 'XRP' },
  { symbol: 'ADAUSDT', base: 'ADA', name: 'Cardano' },
  { symbol: 'DOGEUSDT', base: 'DOGE', name: 'Dogecoin' },
  { symbol: 'AVAXUSDT', base: 'AVAX', name: 'Avalanche' },
]

export const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream'
export const BINANCE_REST_URL = 'https://api.binance.com/api/v3'
