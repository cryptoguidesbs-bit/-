import type { AlertMessage, MacroParams, PatternParams, PriceParams, WhaleParams } from './types'

// ---------------------------------------------------------------------------
// Message composer — factual, event-notification templates. Every body ends
// with the standing disclaimer; no directives, no predictions.
// ---------------------------------------------------------------------------

const DISCLAIMER = '설정하신 조건이 충족되어 보내드리는 정보 제공 목적의 안내이며, 투자 권유가 아닙니다.'

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 4 })}`

export function composePriceAlert(params: PriceParams, currentPrice: number): AlertMessage {
  const cond = params.direction === 'above' ? '이상' : '이하'
  return {
    title: `${params.symbol} 가격 알림`,
    body: `${params.symbol} 가격이 ${fmtUsd(currentPrice)}를 기록하며 설정하신 기준(${fmtUsd(params.threshold)} ${cond})에 도달했습니다. ${DISCLAIMER}`,
  }
}

export function composeWhaleAlert(params: WhaleParams, largestUsd: number, count: number): AlertMessage {
  return {
    title: '웨일 트랜잭션 감지',
    body: `${fmtUsd(params.minUsd)} 이상 BTC 트랜잭션이 ${count}건 포착됐습니다. 가장 큰 건은 약 ${fmtUsd(largestUsd)}입니다. ${DISCLAIMER}`,
  }
}

const PATTERN_NAME_KO: Record<string, string> = {
  triangle: '삼각형 수렴',
  flag: '깃발형',
  cup: '컵앤핸들',
  doubleTop: '이중 천장',
  doubleBottom: '이중 바닥',
  headShoulders: '헤드앤숄더',
}

export function composePatternAlert(
  params: PatternParams,
  patternType: string,
  confidence: number,
): AlertMessage {
  const name = PATTERN_NAME_KO[patternType] ?? patternType
  return {
    title: `${params.symbol} 패턴 감지`,
    body: `${params.symbol} ${params.interval} 차트에서 ${name} 패턴이 포착됐습니다(형태 일치도 ${confidence}%). 이 수치는 차트 모양이 얼마나 비슷한지를 나타낼 뿐, 가격 방향을 예측하는 값이 아닙니다. ${DISCLAIMER}`,
  }
}

export function composeMacroAlert(params: MacroParams, value: number, classification: string): AlertMessage {
  const zone = value <= params.low ? `하단 ${params.low} 이하` : `상단 ${params.high} 이상`
  return {
    title: '공포·탐욕 지수 알림',
    body: `공포·탐욕 지수가 ${value}(${classification})로, 설정하신 ${zone} 구간에 들어왔습니다. ${DISCLAIMER}`,
  }
}
