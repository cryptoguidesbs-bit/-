# v3.0 명세서 대응 — 구현 노트 (2026-09-02)

외부 검토본("CryptoGuide v3.0 기능 개선 개발 명세서 — 검토 완료 + 보강안")에 대한
현 코드베이스 기준 판정과, 이번에 구현한 범위·산식·데이터 소스를 기록한다.

## 1. 판정 요약

| 명세 항목 | 판정 | 근거 |
| --- | --- | --- |
| Market Score (0~100) | **구현 (v1)** | 기존에 서빙 중인 데이터만으로 산출 가능, 가중치·정규화 공개, AI 미개입 |
| Coin Screener | **구현 (v1)** | 무료 공개 API 1회 호출로 상위 100개 표 구성 가능 |
| "데이터 없음/부분/지연" UI 규약 | **구현** | `DataStatus` 컴포넌트로 통일 (unavailable / partial / stale / updated) |
| 규제·면책 문구 | **구현** | Market Score·Screener 페이지 상단/하단 + /data 방법론 |
| Whale Radar | 이미 있음 | /onchain 웨일 추적 + 웨일 알림 |
| Portfolio · Alerts · News Impact(톤) | 이미 있음 | /portfolio, /alerts, 뉴스 톤 게이지·아이템별 심리 |
| AI Chat | 보류 | 실 LLM 키는 법인 설립 후(mock 챗은 무의미). v1 범위는 §4 참고 |
| Token Research (코인별 리서치) | 보류 | 코인별 온체인·파생 데이터는 유료 소스 필요. Tier 접근은 §4 |
| Unlock / Economic Calendar | 보류 | 무료 신뢰 소스 없음(TokenUnlocks·CryptoRank 등 유료) |
| Backtesting · Advanced Charts · Research Report | 보류 | 명세 검토본 자체가 "소형 퀀트 팀 수준"으로 평가 |

## 2. Data Source & API 표 (현행)

| 데이터 | 소스(우선순위) | 비용 | 제한 | 사용처 |
| --- | --- | --- | --- | --- |
| 크립토 시세(3종) | CoinGecko → CoinPaprika → Binance | 무료 | CoinGecko 공개 한도(분당 수십 회), Binance는 미국 IP 451 | 대시보드, Market Score |
| 티커(8종) | 동일 | 무료 | 동일 | 티커, Market Score 상승비율 |
| 전체 시장 집계 | CoinGecko /global → CoinPaprika /global | 무료 | 동일 | Market Score |
| 상위 100 코인 표 | CoinGecko coins/markets → CoinPaprika tickers | 무료 | 2분 캐시로 1회/2분 | Screener |
| Fear & Greed | Alternative.me | 무료 | 5분 캐시 | 대시보드, Market Score |
| 뉴스 톤 | 자체 파이프라인(수집 30분, mock-v1 요약) | 자체 | AI 일 한도(AI_DAILY_CALL_LIMIT) | 뉴스, Market Score |
| 글로벌 지수 | Yahoo Finance 차트(미러 예비) | 무료 | 60초 캐시 | 대시보드 |
| 온체인 네트워크·스테이블코인 | (src/lib/onchain/sources.ts 참고) | 무료 | Pro+ 게이트 | /onchain |
| 결제 지도 | BTCMap / OSM | 무료 | 타일은 OSM 공용 서버 정책 준수 필요 | /map |

미도입(유료·키 필요): Glassnode, CryptoQuant, Nansen, Arkham, Coinglass(파생), 언락 캘린더.

## 3. Market Score v1 산식

`src/lib/market/score.ts` — 가중 평균, 입력 3개 미만이면 산출 안 함(null), 누락 입력은 `missing`으로 보고.

| 입력 | 정규화(0~100) | 가중치 |
| --- | --- | --- |
| BTC 24h 등락(%) | 50 + x × 8 | 20 |
| 전체 시총 24h 변화(%) | 50 + x × 10 | 15 |
| 상승 종목 비율(티커 8종) | 비율 × 100 | 15 |
| Fear & Greed | 그대로 | 20 |
| 뉴스 톤(신뢰도 ±) | 50 ± 신뢰도 ÷ 2 | 20 |
| 변동성 안정도 | 100 − \|x\| × 12.5 | 10 |

구간: 0–19 cold · 20–39 riskOff · 40–59 neutral · 60–79 riskOn · 80–100 overheated.
서버 메모 60초. 매수/매도 등 방향 언어는 페이로드·UI 모두에서 금지(테스트로 검증).

## 4. 보류 항목의 향후 범위(명세 검토본 반영)

- AI Chat v1: Market Score 요약 + 주요 지표(BTC, 거래량, F&G, 뉴스 톤)만 참조하는 비개인화 Q&A. 실키 전환 후 착수.
- Token Research: Tier 1(BTC/ETH/SOL 등 상위 10~20)만 기술·뉴스·기본 온체인, Tier 2는 시세·뉴스, Tier 3는 시세만.
- Backtesting v1: 패턴 3개, 일봉, BTC/ETH만.

## 5. 가드레일(변경 없음)

매매 신호·맞춤 권고·자동매매·수익 보장·거래소 기능은 어떤 항목에서도 도입하지 않는다. Market Score는 "시장 상태 요약"으로만 문구를 유지한다.
