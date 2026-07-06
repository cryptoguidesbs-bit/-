import type { DetectedPattern, SrLevel } from './detect'
import { checkPatternText } from './guidelines'

// ---------------------------------------------------------------------------
// Deterministic description templates: pattern existence + measured
// statistical context only. Every string is verified against the directive
// filter; a violating template (should never happen) falls back to a
// minimal safe sentence.
// ---------------------------------------------------------------------------

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: v < 10 ? 4 : 0,
  }).format(v)

const pct = (v: number) => `${v.toFixed(1)}%`

type Localized = { ko: string; en: string }

function template(pattern: DetectedPattern): Localized {
  const s = pattern.stats
  switch (pattern.type) {
    case 'doubleTop':
      return {
        ko: `이중 천장(Double Top) 형태가 관측되었습니다. 두 고점은 ${usd(s.first)}와 ${usd(s.second)}로 서로 ${pct(s.diffPct)} 이내에서 형성되었고, 사이 구간의 되돌림 폭은 ${pct(s.retracePct)}로 측정됩니다.`,
        en: `A double-top shape was observed. The two highs formed at ${usd(s.first)} and ${usd(s.second)}, within ${pct(s.diffPct)} of each other, with a measured retracement of ${pct(s.retracePct)} between them.`,
      }
    case 'doubleBottom':
      return {
        ko: `이중 바닥(Double Bottom) 형태가 관측되었습니다. 두 저점은 ${usd(s.first)}와 ${usd(s.second)}로 서로 ${pct(s.diffPct)} 이내에서 형성되었고, 사이 구간의 반등 폭은 ${pct(s.retracePct)}로 측정됩니다.`,
        en: `A double-bottom shape was observed. The two lows formed at ${usd(s.first)} and ${usd(s.second)}, within ${pct(s.diffPct)} of each other, with a measured bounce of ${pct(s.retracePct)} between them.`,
      }
    case 'headShoulders':
      return {
        ko: `헤드앤숄더(Head & Shoulders) 형태가 관측되었습니다. 머리는 ${usd(s.head)}, 좌우 어깨는 각각 ${usd(s.leftShoulder)}·${usd(s.rightShoulder)}로 어깨 간 편차는 ${pct(s.shoulderDiffPct)}, 머리와 어깨의 높이 차는 ${pct(s.headRisePct)}로 측정됩니다.`,
        en: `A head-and-shoulders shape was observed. The head printed at ${usd(s.head)} with shoulders at ${usd(s.leftShoulder)} and ${usd(s.rightShoulder)} — a ${pct(s.shoulderDiffPct)} shoulder difference and a ${pct(s.headRisePct)} head elevation.`,
      }
    case 'triangle':
      return {
        ko: `수렴형 삼각형(Triangle) 형태가 관측되었습니다. 고점 ${s.highTouches}회·저점 ${s.lowTouches}회의 피벗이 형성되며 가격 범위가 ${pct(s.compressionPct)} 축소되었습니다. 범위 축소는 변동성 압축 상태를 나타내는 통계적 관찰입니다.`,
        en: `A converging triangle shape was observed, built on ${s.highTouches} high pivots and ${s.lowTouches} low pivots with the price range compressing by ${pct(s.compressionPct)}. Range compression is a statistical observation of reduced volatility.`,
      }
    case 'flag':
      return {
        ko: `깃발형(Flag) 형태가 관측되었습니다. 직전 ${s.poleLen}개 캔들 동안 ${pct(Math.abs(s.polePct))}의 급격한 가격 변동(깃대) 이후, ${s.flagLen}개 캔들에 걸쳐 ${pct(s.flagRangePct)} 범위의 좁은 흐름이 이어졌습니다.`,
        en: `A flag shape was observed: a sharp ${pct(Math.abs(s.polePct))} move over ${s.poleLen} candles (the pole), followed by a narrow ${pct(s.flagRangePct)} consolidation across ${s.flagLen} candles.`,
      }
    case 'cup':
      return {
        ko: `컵(Cup) 형태가 관측되었습니다. 좌측 림 ${usd(s.leftRim)}에서 저점 ${usd(s.bottom)}까지 ${pct(s.depthPct)} 깊이의 완만한 U자형 흐름 후, 우측 림이 ${usd(s.rightRim)} 부근까지 회복된 구조입니다(관찰 구간 ${s.spanCandles}개 캔들).`,
        en: `A cup shape was observed: a rounded ${pct(s.depthPct)}-deep move from the left rim at ${usd(s.leftRim)} to a bottom of ${usd(s.bottom)}, recovering to a right rim near ${usd(s.rightRim)} (over ${s.spanCandles} candles).`,
      }
  }
}

const SAFE_FALLBACK: Localized = {
  ko: '해당 구간에서 패턴 형태가 관측되었습니다. 세부 수치는 표시할 수 없습니다.',
  en: 'A pattern shape was observed in this range. Detailed figures are unavailable.',
}

export function describePattern(pattern: DetectedPattern): Localized {
  const text = template(pattern)
  // Directive filter — belt and suspenders over the templates.
  if (!checkPatternText(text.ko).ok || !checkPatternText(text.en).ok) {
    return SAFE_FALLBACK
  }
  return text
}

export function describeLevel(level: SrLevel): Localized {
  const kindKo = level.kind === 'support' ? '지지' : '저항'
  const text = {
    ko: `${usd(level.price)} 부근에서 ${level.touches}회 반응한 ${kindKo} 레벨이 관측됩니다.`,
    en: `A ${level.kind} level is observed near ${usd(level.price)}, touched ${level.touches} times.`,
  }
  if (!checkPatternText(text.ko).ok || !checkPatternText(text.en).ok) {
    return SAFE_FALLBACK
  }
  return text
}
