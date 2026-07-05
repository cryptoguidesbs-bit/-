import type { ArticleAnalysis } from './provider'

// ---------------------------------------------------------------------------
// AI sanity checks. Every model output passes through here before being
// published; failures are retried and finally HELD (never published).
// ---------------------------------------------------------------------------

export type SanityResult = { ok: true } | { ok: false; reason: string }

const SENTIMENTS = new Set(['bullish', 'neutral', 'bearish'])

// Compliance: reader-directed advice / profit-promise phrases. News can
// REPORT that an analyst recommends something; the summary itself must not
// instruct the reader.
const BANNED_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /매수하세요|매도하세요|사세요|파세요/, label: 'reader-directed trade advice (ko)' },
  { pattern: /수익.{0,6}보장|보장된.{0,6}수익|확실한.{0,4}(수익|기회)/, label: 'profit guarantee (ko)' },
  { pattern: /guaranteed (profit|return|gain)/i, label: 'profit guarantee (en)' },
  { pattern: /\bbuy now\b|\bsell now\b/i, label: 'reader-directed trade advice (en)' },
  { pattern: /can'?t lose|risk[- ]free (profit|return)/i, label: 'risk-free claim (en)' },
]

const AI_ARTIFACT_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /as an ai\b|i cannot|i'm sorry/i, label: 'assistant-persona leakage' },
  { pattern: /https?:\/\//i, label: 'URL in summary' },
  { pattern: /(.)\1{7,}/, label: 'repeated character run' },
  { pattern: /\{|\}|"summary_ko"/, label: 'JSON artifact in text' },
]

function checkSummary(text: string, name: string, min: number, max: number): SanityResult {
  const trimmed = text.trim()
  if (trimmed.length < min) return { ok: false, reason: `${name} too short (${trimmed.length} chars)` }
  if (trimmed.length > max) return { ok: false, reason: `${name} too long (${trimmed.length} chars)` }
  for (const { pattern, label } of AI_ARTIFACT_PATTERNS) {
    if (pattern.test(trimmed)) return { ok: false, reason: `${name}: ${label}` }
  }
  for (const { pattern, label } of BANNED_PATTERNS) {
    if (pattern.test(trimmed)) return { ok: false, reason: `${name}: compliance — ${label}` }
  }
  return { ok: true }
}

export function sanityCheck(analysis: ArticleAnalysis, articleTitle: string): SanityResult {
  if (!SENTIMENTS.has(analysis.sentiment)) {
    return { ok: false, reason: `invalid sentiment "${analysis.sentiment}"` }
  }
  if (
    typeof analysis.confidence !== 'number' ||
    !Number.isFinite(analysis.confidence) ||
    analysis.confidence < 0 ||
    analysis.confidence > 100
  ) {
    return { ok: false, reason: `confidence out of range (${analysis.confidence})` }
  }

  const ko = checkSummary(analysis.summary_ko, 'summary_ko', 20, 600)
  if (!ko.ok) return ko
  const en = checkSummary(analysis.summary_en, 'summary_en', 20, 700)
  if (!en.ok) return en

  // A summary that is just the title verbatim adds nothing — treat as failure.
  if (analysis.summary_en.trim().toLowerCase() === articleTitle.trim().toLowerCase()) {
    return { ok: false, reason: 'summary identical to title' }
  }

  return { ok: true }
}
