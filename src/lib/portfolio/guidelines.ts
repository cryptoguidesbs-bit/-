// ---------------------------------------------------------------------------
// Principle A-2-7: portfolio AI output is limited to indicator explanation,
// visualization support, and educational commentary. Directive/advisory
// phrasing ("rebalance", "reduce your position", "we recommend") is banned —
// violating output is blocked and never shown.
// ---------------------------------------------------------------------------

export type PortfolioGuidelineResult = { ok: true } | { ok: false; reason: string }

const BANNED: { pattern: RegExp; label: string }[] = [
  // Korean directives
  {
    pattern: /리밸런싱.{0,8}(하세요|해야|하시기|권장|추천|필요합니다)/,
    label: 'rebalancing directive (ko)',
  },
  {
    pattern: /(비중|포지션|보유량)을?\s?(줄이|늘리|축소하|확대하)(세요|십시오|시기|는 (것이|게) 좋)/,
    label: 'position-sizing directive (ko)',
  },
  { pattern: /매수하세요|매도하세요|사세요|파세요|추천(합니다|드립니다)/, label: 'trade directive (ko)' },
  { pattern: /분산하세요|분산 ?투자하세요/, label: 'diversification directive (ko)' },
  // English directives
  {
    pattern: /\byou (should|need to|must|ought to) (rebalance|buy|sell|reduce|increase|trim|add|diversify)\b/i,
    label: 'directive (en)',
  },
  { pattern: /\bwe (recommend|suggest|advise)\b/i, label: 'recommendation (en)' },
  {
    pattern: /\bconsider (rebalancing|buying|selling|reducing|increasing|trimming|diversifying)\b/i,
    label: 'soft directive (en)',
  },
  { pattern: /\bit (would be|is) (wise|advisable|prudent) to\b/i, label: 'advisory phrasing (en)' },
  { pattern: /\brebalance (your|the) portfolio\b/i, label: 'rebalancing directive (en)' },
]

// Educational output must actually discuss the metrics.
const ON_TOPIC_KO = /분산|집중|비중|지표|배분|HHI|허핀달/
const ON_TOPIC_EN = /diversif|concentrat|weight|allocation|metric|HHI|index/i

export function checkPortfolioCommentary(text: {
  ko: string
  en: string
}): PortfolioGuidelineResult {
  for (const [lang, value] of Object.entries(text) as ['ko' | 'en', string][]) {
    const trimmed = value.trim()
    if (trimmed.length < 40) return { ok: false, reason: `${lang}: too short` }
    if (trimmed.length > 2500) return { ok: false, reason: `${lang}: too long` }
    for (const { pattern, label } of BANNED) {
      const match = trimmed.match(pattern)
      if (match) {
        return { ok: false, reason: `${lang}: ${label} — "${match[0].slice(0, 40)}"` }
      }
    }
    const onTopic = lang === 'ko' ? ON_TOPIC_KO : ON_TOPIC_EN
    if (!onTopic.test(trimmed)) {
      return { ok: false, reason: `${lang}: not about portfolio metrics` }
    }
  }
  return { ok: true }
}
