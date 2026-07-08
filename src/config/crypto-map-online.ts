import type { MapCategory, MapCoin } from './crypto-map'

// Online crypto services — our curated local list (no location, shown as a
// side list, not map pins). Informational only. Extend as needed.
export type OnlineService = {
  id: string
  name: string
  category: Exclude<MapCategory, 'atm'> | 'exchange' | 'payments' | 'giftcard' | 'travel'
  coins: MapCoin[]
  url: string
  /** HQ country (ISO alpha-2), optional. */
  countryCode?: string
  descKo: string
  descEn: string
}

export const ONLINE_SERVICES: OnlineService[] = [
  {
    id: 'bitrefill',
    name: 'Bitrefill',
    category: 'giftcard',
    coins: ['btc', 'lightning', 'eth', 'usdt', 'usdc'],
    url: 'https://www.bitrefill.com',
    descKo: '기프트카드·모바일 충전을 크립토로 구매',
    descEn: 'Buy gift cards and mobile top-ups with crypto',
  },
  {
    id: 'travala',
    name: 'Travala',
    category: 'travel',
    coins: ['btc', 'eth', 'usdt', 'usdc'],
    url: 'https://www.travala.com',
    descKo: '크립토로 호텔·항공권 예약',
    descEn: 'Book hotels and flights with crypto',
  },
  {
    id: 'btcpayserver',
    name: 'BTCPay Server',
    category: 'payments',
    coins: ['btc', 'lightning'],
    url: 'https://btcpayserver.org',
    descKo: '오픈소스 자가호스팅 결제 게이트웨이',
    descEn: 'Open-source self-hosted payment gateway',
  },
  {
    id: 'strike',
    name: 'Strike',
    category: 'payments',
    coins: ['btc', 'lightning'],
    url: 'https://strike.me',
    descKo: '라이트닝 기반 송금·결제',
    descEn: 'Lightning-based payments and transfers',
  },
  {
    id: 'coingate',
    name: 'CoinGate',
    category: 'payments',
    coins: ['btc', 'lightning', 'eth', 'usdt', 'usdc'],
    url: 'https://coingate.com',
    descKo: '가맹점용 크립토 결제 처리',
    descEn: 'Crypto payment processing for merchants',
  },
  {
    id: 'namecheap',
    name: 'Namecheap',
    category: 'shop',
    coins: ['btc', 'eth', 'usdt'],
    url: 'https://www.namecheap.com',
    descKo: '도메인·호스팅을 크립토로 결제',
    descEn: 'Pay for domains and hosting with crypto',
  },
]
