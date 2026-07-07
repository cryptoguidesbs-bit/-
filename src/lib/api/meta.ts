import { siteUrl } from '@/lib/site'

// Usage terms attached to EVERY public API response. The data is
// informational only and may not be redistributed.

export function apiMeta() {
  return {
    provider: 'CryptoGuide API v1',
    docs: `${siteUrl}/api-center`,
    disclaimer: {
      ko: '본 데이터는 정보 제공 목적으로만 제공되며 투자 권유가 아닙니다. 데이터의 정확성·적시성은 보장되지 않으며, 이용에 따른 판단과 책임은 이용자에게 있습니다.',
      en: 'This data is provided for informational purposes only and is not investment advice. Accuracy and timeliness are not guaranteed; decisions based on it are your own responsibility.',
    },
    terms: {
      ko: '데이터의 재배포·재판매·대중 공개 게시를 금지합니다. API 이용은 서비스 이용약관 및 API 이용 조건을 따릅니다.',
      en: 'Redistribution, resale, or public re-publication of this data is prohibited. API usage is subject to the Terms of Service and API terms.',
    },
  }
}
