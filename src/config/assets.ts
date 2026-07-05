// Stage 7 display assets: 3 crypto + 6 traditional (indices, commodities, FX).
export type CryptoAsset = {
  id: 'BTC' | 'ETH' | 'SOL'
  name: string
  binanceSymbol: string
}

export const cryptoAssets: CryptoAsset[] = [
  { id: 'BTC', name: 'Bitcoin', binanceSymbol: 'BTCUSDT' },
  { id: 'ETH', name: 'Ethereum', binanceSymbol: 'ETHUSDT' },
  { id: 'SOL', name: 'Solana', binanceSymbol: 'SOLUSDT' },
]

export type TraditionalAsset = {
  id: 'NASDAQ' | 'SP500' | 'KOSPI' | 'GOLD' | 'OIL' | 'DXY'
  name: string
  yahooSymbol: string
  /** Kind drives number formatting (index points vs USD). */
  kind: 'index' | 'commodity'
}

export const traditionalAssets: TraditionalAsset[] = [
  { id: 'NASDAQ', name: 'NASDAQ', yahooSymbol: '^IXIC', kind: 'index' },
  { id: 'SP500', name: 'S&P 500', yahooSymbol: '^GSPC', kind: 'index' },
  { id: 'KOSPI', name: 'KOSPI', yahooSymbol: '^KS11', kind: 'index' },
  { id: 'GOLD', name: 'Gold', yahooSymbol: 'GC=F', kind: 'commodity' },
  { id: 'OIL', name: 'WTI Oil', yahooSymbol: 'CL=F', kind: 'commodity' },
  { id: 'DXY', name: 'Dollar Index', yahooSymbol: 'DX-Y.NYB', kind: 'index' },
]
