// Language-neutral request/response samples for the API Center docs. Kept
// out of the i18n messages on purpose: braces would break ICU formatting.
export const API_SAMPLES = {
  meta: `"meta": {
  "provider": "CryptoGuide API v1",
  "docs": "https://cryptoguide.live/api-center",
  "disclaimer": { "ko": "본 데이터는 정보 제공 목적으로만 제공되며 투자 권유가 아닙니다. …", "en": "This data is provided for informational purposes only and is not investment advice. …" },
  "terms": { "ko": "데이터의 재배포·재판매·대중 공개 게시를 금지합니다. …", "en": "Redistribution, resale, or public re-publication of this data is prohibited. …" }
}`,
  prices: {
    curl: (origin: string) => `curl -H "Authorization: Bearer cg_live_…" \\\n  ${origin}/api/v1/market/prices`,
    response: `{
  "data": [
    { "id": "BTC", "name": "Bitcoin",  "price": 64123.5, "changePct": -1.23 },
    { "id": "ETH", "name": "Ethereum", "price": 3105.2,  "changePct":  0.41 },
    { "id": "SOL", "name": "Solana",   "price": 142.8,   "changePct":  2.05 }
  ],
  "stale": false,
  "updatedAt": "2026-08-24T01:23:45.000Z",
  "meta": { … }
}`,
  },
  sentiment: {
    curl: (origin: string) => `curl -H "x-api-key: cg_live_…" \\\n  ${origin}/api/v1/market/sentiment`,
    response: `{
  "data": { "value": 42, "classification": "Fear", "timestamp": 1756000000000 },
  "stale": false,
  "updatedAt": "2026-08-24T01:20:00.000Z",
  "meta": { … }
}`,
  },
  briefs: {
    curl: (origin: string) => `curl -H "Authorization: Bearer cg_live_…" \\\n  ${origin}/api/v1/briefs/latest`,
    response: `{
  "data": {
    "briefDate": "2026-08-24",
    "tier": "DETAILED",
    "sections": {
      "btc":     { "ko": "…", "en": "…" },
      "eth":     { "ko": "…", "en": "…" },
      "altcoin": { "ko": "…", "en": "…" },
      "macro":   { "ko": "…", "en": "…" },
      "today":   { "ko": "…", "en": "…" }
    },
    "aiModel": "claude-…",
    "createdAt": "2026-08-23T22:31:02.000Z",
    "aiGenerated": true
  },
  "meta": { … }
}`,
  },
  error429: `HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
Retry-After: 37

{ "error": "rate limit exceeded" }`,
  webhookDelivery: `POST https://example.com/webhook
content-type: application/json
x-cryptoguide-event: brief.published
x-cryptoguide-signature: sha256=9f2c…

{ "event": "brief.published", "data": { "briefDate": "2026-08-24", "tier": "STANDARD" }, "sentAt": "2026-08-23T22:31:05.000Z" }`,
  webhookVerifyNode: `import crypto from 'node:crypto'

export function verify(rawBody: string, header: string, secret: string) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return expected.length === header.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header))
}`,
} as const

export type ApiSampleKey = 'prices' | 'sentiment' | 'briefs'
