// ---------------------------------------------------------------------------
// Alert expression guidelines — alerts are EVENT NOTIFICATIONS only.
// They state that a configured condition occurred; they never instruct the
// user to act ("buy now"), never predict direction, never promise profit.
// Every outgoing message passes checkAlertText before delivery; a violation
// blocks the send (delivery recorded as SKIPPED).
// ---------------------------------------------------------------------------

type BannedRule = { pattern: RegExp; reason: string }

const BANNED: BannedRule[] = [
  // Korean action directives
  {
    pattern: /매수하세요|매도하세요|사세요|파세요|사야\s*합니다|팔아야\s*합니다|매수\s*추천|매도\s*추천|추천합니다|추천드립니다|리밸런싱하세요/,
    reason: '행동 지시(매수/매도 권유) 표현',
  },
  { pattern: /지금\s*(매수|매도|구매|판매|진입|청산)/, reason: '즉시 행동 지시 표현' },
  // Trade instruction levels
  { pattern: /진입가|목표가|손절가|익절가|물타기/, reason: '매매 지시 수치(진입·목표·손절) 표현' },
  // English action directives
  {
    pattern: /\b(buy|sell)\s+now\b|\byou\s+should\s+(buy|sell)\b|\bwe\s+recommend\b|\btime\s+to\s+(buy|sell)\b|\bentry\s+price\b|\btake\s+profit\b|\bstop\s+loss\s+at\b/i,
    reason: 'English action-directive phrasing',
  },
  // Profit guarantees
  { pattern: /수익.{0,6}보장|무조건\s*수익|guaranteed\s+(profit|return)/i, reason: '수익 보장 표현' },
  // Definitive direction predictions
  {
    pattern: /반드시\s*(상승|하락)|확실히\s*(상승|하락)|급등할\s*것|급락할\s*것|오를\s*것입니다|내릴\s*것입니다|\bwill\s+(surge|crash|moon)\b/i,
    reason: '단정적 방향 예측 표현',
  },
]

export type AlertTextCheck = { ok: boolean; reason?: string; matched?: string }

export function checkAlertText(text: string): AlertTextCheck {
  for (const rule of BANNED) {
    const m = text.match(rule.pattern)
    if (m) return { ok: false, reason: rule.reason, matched: m[0] }
  }
  return { ok: true }
}
