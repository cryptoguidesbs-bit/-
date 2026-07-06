import type { AlertMessage, MacroParams, PatternParams, PriceParams, WhaleParams } from './types'

// ---------------------------------------------------------------------------
// Message composer — factual, event-notification templates. Every body ends
// with the standing disclaimer; no directives, no predictions.
// ---------------------------------------------------------------------------

const DISCLAIMER = '본 알림은 설정하신 조건의 발생을 알리는 정보 제공 목적의 통지이며, 투자 권유가 아닙니다.'

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 4 })}`

export function composePriceAlert(params: PriceParams, currentPrice: number): AlertMessage {
  const cond = params.direction === 'above' ? '이상' : '이하'
  return {
    title: `${params.symbol} 가격 알림`,
    body: `${params.symbol} 가격이 설정 기준 ${fmtUsd(params.threshold)} ${cond} 조건에 도달했습니다. 현재 가격: ${fmtUsd(currentPrice)}. ${DISCLAIMER}`,
  }
}

export function composeWhaleAlert(params: WhaleParams, largestUsd: number, count: number): AlertMessage {
  return {
    title: '웨일 트랜잭션 감지',
    body: `설정 기준(${fmtUsd(params.minUsd)} 이상)을 충족하는 대형 BTC 트랜잭션 ${count}건이 감지되었습니다. 최대 규모: 약 ${fmtUsd(largestUsd)}. ${DISCLAIMER}`,
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
    body: `${params.symbol} ${params.interval} 차트에서 ${name} 형태가 감지되었습니다 (형태 일치 신뢰도 ${confidence}%). 신뢰도는 가격 방향 예측이 아닌 형태 일치 정도를 뜻합니다. ${DISCLAIMER}`,
  }
}

export function composeMacroAlert(params: MacroParams, value: number, classification: string): AlertMessage {
  const zone = value <= params.low ? `설정 하단(${params.low}) 이하` : `설정 상단(${params.high}) 이상`
  return {
    title: '공포·탐욕 지수 알림',
    body: `Fear & Greed 지수가 ${value}(${classification})를 기록해 ${zone} 구간에 진입했습니다. ${DISCLAIMER}`,
  }
}
