// ---------------------------------------------------------------------------
// Pattern output guidelines (stage 13): descriptions may state the pattern's
// EXISTENCE and measured statistical context only. Banned everywhere:
//   - trade instructions (진입가/목표가/손절가, entry/target/stop-loss)
//   - buy/sell directives
//   - directional predictions ("will rise", "돌파할 것")
// Every generated description passes through this check before being served.
// ---------------------------------------------------------------------------

export type PatternGuidelineResult = { ok: true } | { ok: false; reason: string }

const BANNED: { pattern: RegExp; label: string }[] = [
  // Trade-instruction vocabulary
  { pattern: /진입가|진입 ?시점|매수 ?구간|매도 ?구간|목표가|타겟 ?가|손절가|손절 ?라인|익절/, label: 'trade levels (ko)' },
  { pattern: /\bentry (price|point|level|zone)\b|\btarget (price|level)\b|\bstop[- ]?loss\b|\btake[- ]?profit\b/i, label: 'trade levels (en)' },
  // Buy/sell directives
  { pattern: /매수하세요|매도하세요|사세요|파세요|진입하세요|청산하세요|추천(합니다|드립니다)/, label: 'trade directive (ko)' },
  { pattern: /\b(buy|sell|enter|exit|long|short) (now|here|at)\b|\byou should (buy|sell|enter|exit)\b|\bwe recommend\b/i, label: 'trade directive (en)' },
  // Directional predictions
  { pattern: /(상승|하락|급등|급락|돌파|반등)할 (것입니다|것이다|전망입니다)|반드시|확실히/, label: 'directional prediction (ko)' },
  { pattern: /\bwill (rise|fall|surge|crash|break ?out|bounce|reach)\b|\bguaranteed\b/i, label: 'directional prediction (en)' },
  // Profit language
  { pattern: /수익.{0,6}보장|확실한 수익/, label: 'profit claim (ko)' },
  { pattern: /guaranteed (profit|return|gain)|risk[- ]free/i, label: 'profit claim (en)' },
]

export function checkPatternText(text: string): PatternGuidelineResult {
  for (const { pattern, label } of BANNED) {
    const match = text.match(pattern)
    if (match) {
      return { ok: false, reason: `${label} — "${match[0].slice(0, 40)}"` }
    }
  }
  return { ok: true }
}
