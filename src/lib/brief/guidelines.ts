// ---------------------------------------------------------------------------
// Expression guidelines for AI Market Briefs (stage 9).
//   1. No definitive predictions  — "반드시 급등한다", "will surge"
//   2. Probabilistic language     — every section must hedge (가능성/수 있/may/…)
//   3. No action directives       — "매수하세요", "buy now", "추천합니다"
//   4. No profit guarantees
// Violations retry, then the brief is HELD — never published.
// ---------------------------------------------------------------------------

export type GuidelineResult = { ok: true } | { ok: false; reason: string }

const BANNED: { pattern: RegExp; label: string }[] = [
  // Definitive predictions (ko)
  {
    pattern: /(반드시|확실히|무조건|틀림없이).{0,12}(상승|하락|급등|급락|오른|내린|도달)/,
    label: 'definitive prediction (ko)',
  },
  { pattern: /(급등|급락|상승|하락|돌파|도달)할 것입니다/, label: 'definitive prediction (ko)' },
  { pattern: /확실한 (상승|하락|기회|수익)/, label: 'definitive claim (ko)' },
  // Definitive predictions (en)
  {
    pattern: /\bwill (surge|soar|crash|plunge|rise|fall|moon|double|reach|hit)\b/i,
    label: 'definitive prediction (en)',
  },
  { pattern: /\b(definitely|certainly|guaranteed to) (rise|fall|surge|crash)/i, label: 'definitive prediction (en)' },
  // Action directives
  { pattern: /매수하세요|매도하세요|사세요|파세요|추천합니다|추천드립니다/, label: 'action directive (ko)' },
  { pattern: /\b(buy|sell) now\b|\byou should (buy|sell)\b|\bwe recommend (buying|selling)\b/i, label: 'action directive (en)' },
  // Profit guarantees
  { pattern: /수익.{0,6}보장|보장된.{0,6}수익/, label: 'profit guarantee (ko)' },
  { pattern: /guaranteed (profit|return|gain)|risk[- ]free/i, label: 'profit guarantee (en)' },
]

const PROBABILISTIC_KO =
  /가능성|수 있|보입니다|보이며|관측|전망|예상|우려|기대|시사|추정|평가|해석|주목|~일 수|분석됩니다|나타냅니다/
const PROBABILISTIC_EN =
  /\b(may|could|might|likely|unlikely|possib\w*|appear\w*|suggest\w*|potential\w*|expect\w*|seem\w*|indicat\w*|watch\w*|remain\w* to be seen)\b/i

export const BRIEF_SECTION_KEYS = ['btc', 'eth', 'altcoin', 'macro', 'today'] as const
export type BriefSectionKey = (typeof BRIEF_SECTION_KEYS)[number]

export type LocalizedText = { ko: string; en: string }
export type BriefSections = Record<BriefSectionKey, LocalizedText>

/**
 * Reusable narrative checker (briefs, research reports): length bounds,
 * banned definitive/directive/guarantee phrasing, probabilistic language
 * required (unless requireProbabilistic is false — e.g. titles).
 */
export function checkNarrativeText(
  text: string,
  lang: 'ko' | 'en',
  label: string,
  opts: { minLen?: number; maxLen?: number; requireProbabilistic?: boolean } = {},
): GuidelineResult {
  const { minLen = 40, maxLen = 3000, requireProbabilistic = true } = opts
  const trimmed = text.trim()
  if (trimmed.length < minLen) {
    return { ok: false, reason: `${label}.${lang}: too short (${trimmed.length} chars)` }
  }
  if (trimmed.length > maxLen) {
    return { ok: false, reason: `${label}.${lang}: too long (${trimmed.length} chars)` }
  }
  for (const { pattern, label: banLabel } of BANNED) {
    const match = trimmed.match(pattern)
    if (match) {
      return { ok: false, reason: `${label}.${lang}: ${banLabel} — "${match[0].slice(0, 40)}"` }
    }
  }
  if (requireProbabilistic) {
    const probabilistic = lang === 'ko' ? PROBABILISTIC_KO : PROBABILISTIC_EN
    if (!probabilistic.test(trimmed)) {
      return { ok: false, reason: `${label}.${lang}: missing probabilistic language` }
    }
  }
  return { ok: true }
}

function checkText(text: string, lang: 'ko' | 'en', section: string): GuidelineResult {
  return checkNarrativeText(text, lang, section)
}

export function checkGuidelines(sections: BriefSections): GuidelineResult {
  for (const key of BRIEF_SECTION_KEYS) {
    const section = sections[key]
    if (!section?.ko || !section?.en) {
      return { ok: false, reason: `${key}: missing localized content` }
    }
    const ko = checkText(section.ko, 'ko', key)
    if (!ko.ok) return ko
    const en = checkText(section.en, 'en', key)
    if (!en.ok) return en
  }
  return { ok: true }
}
