// ---------------------------------------------------------------------------
// Education curriculum (stage 15) — static, version-controlled content.
// Access strategy (conversion funnel):
//   beginner    → free  (everyone, signed-out included)
//   intermediate→ member (free account required — sign-up funnel)
//   advanced    → standard (Standard+ plan — subscription funnel)
// All content is educational: concepts and methods explained descriptively,
// never personal advice or trade directives.
// ---------------------------------------------------------------------------

export type EducationTrack = 'trading' | 'technical' | 'risk' | 'psychology'
export type EducationLevel = 'beginner' | 'intermediate' | 'advanced'
export type LessonAccess = 'free' | 'member' | 'standard'

export const EDUCATION_TRACKS: EducationTrack[] = ['trading', 'technical', 'risk', 'psychology']
export const EDUCATION_LEVELS: EducationLevel[] = ['beginner', 'intermediate', 'advanced']

export const ACCESS_BY_LEVEL: Record<EducationLevel, LessonAccess> = {
  beginner: 'free',
  intermediate: 'member',
  advanced: 'standard',
}

export type Lesson = {
  slug: string
  track: EducationTrack
  level: EducationLevel
  access: LessonAccess
  minutes: number
  title: { ko: string; en: string }
  summary: { ko: string; en: string }
  content: { ko: string; en: string }
}

const L = (
  slug: string,
  track: EducationTrack,
  level: EducationLevel,
  minutes: number,
  title: Lesson['title'],
  summary: Lesson['summary'],
  content: Lesson['content'],
): Lesson => ({ slug, track, level, access: ACCESS_BY_LEVEL[level], minutes, title, summary, content })

export const lessons: Lesson[] = [
  // --- Trading 기초 ---------------------------------------------------------
  L(
    'trading-exchange-basics',
    'trading',
    'beginner',
    6,
    { ko: '거래소와 주문의 기초', en: 'Exchanges and Order Basics' },
    {
      ko: '거래소의 종류, 시장가·지정가 주문, 수수료와 보관 방식의 기본 개념을 다룹니다.',
      en: 'Exchange types, market vs limit orders, fees, and custody basics.',
    },
    {
      ko: `## 거래소란
암호화폐 거래소는 구매자와 판매자를 연결하는 시장입니다. 중앙화 거래소(CEX)는 회사가 주문 매칭과 자산 보관을 담당하고, 탈중앙화 거래소(DEX)는 스마트 컨트랙트가 그 역할을 수행합니다. 두 방식은 수수료, 속도, 보관 책임에서 서로 다른 특성을 갖습니다.

## 시장가 주문과 지정가 주문
시장가 주문은 현재 호가에 즉시 체결되는 주문으로, 체결 속도가 빠른 대신 가격이 예상과 달라질 수 있습니다. 지정가 주문은 지정한 가격에 도달할 때만 체결되며, 가격을 통제할 수 있는 대신 체결되지 않을 수도 있습니다. 트레이더들은 상황에 따라 두 주문을 구분해 사용합니다.

## 수수료 구조
거래소 수수료는 보통 거래 금액의 일정 비율로 부과되며, 유동성을 공급하는 주문(메이커)과 소비하는 주문(테이커)에 다른 요율이 적용되는 경우가 많습니다. 잦은 거래는 수수료 부담을 빠르게 누적시킬 수 있다는 점이 자주 언급됩니다.

## 보관(커스터디)의 개념
거래소에 자산을 두면 편리하지만 거래소 리스크에 노출되고, 개인 지갑으로 옮기면 개인 키 관리 책임이 생깁니다. "Not your keys, not your coins"라는 격언은 이 트레이드오프를 요약하는 표현으로 알려져 있습니다.

## 정리
이 레슨은 개념 설명을 위한 교육 자료이며, 특정 거래소나 거래 방식을 권장하지 않습니다.`,
      en: `## What an exchange is
A crypto exchange is a marketplace connecting buyers and sellers. Centralized exchanges (CEXs) match orders and hold custody as a company, while decentralized exchanges (DEXs) do this through smart contracts. The two models differ in fees, speed, and custody responsibility.

## Market vs limit orders
A market order executes immediately at the best available price — fast, but the fill price can differ from what you saw. A limit order executes only at your chosen price — you control the price, but the order may never fill. Traders distinguish between the two depending on context.

## Fee structure
Exchange fees are usually a percentage of trade size, often with different rates for makers (adding liquidity) and takers (removing it). It is commonly noted that frequent trading can compound fee costs quickly.

## Custody
Keeping assets on an exchange is convenient but exposes you to exchange risk; moving them to a personal wallet shifts responsibility for key management to you. The saying "not your keys, not your coins" summarizes this trade-off.

## Note
This lesson is educational material explaining concepts — it does not recommend any exchange or trading approach.`,
    },
  ),
  L(
    'trading-orderbook-liquidity',
    'trading',
    'intermediate',
    8,
    { ko: '호가창과 유동성 이해', en: 'Order Books and Liquidity' },
    {
      ko: '호가창 구조, 스프레드, 슬리피지, 유동성이 체결 품질에 미치는 영향을 설명합니다.',
      en: 'Order book structure, spread, slippage, and how liquidity shapes execution.',
    },
    {
      ko: `## 호가창의 구조
호가창(오더북)은 매수 주문(비드)과 매도 주문(애스크)이 가격별로 쌓여 있는 목록입니다. 최우선 매수가와 최우선 매도가의 차이를 스프레드라고 하며, 스프레드가 좁을수록 즉시 거래에 드는 암묵적 비용이 작다고 해석됩니다.

## 슬리피지
큰 주문이 여러 호가를 소진하며 체결되면 평균 체결가가 예상보다 불리해질 수 있는데, 이를 슬리피지라고 합니다. 유동성이 얕은 시장이나 변동성이 큰 순간에 슬리피지가 커지는 경향이 관찰됩니다.

## 유동성의 의미
유동성은 가격에 큰 영향을 주지 않고 자산을 사고팔 수 있는 정도를 뜻합니다. 거래량, 호가창 깊이, 스프레드가 유동성을 가늠하는 지표로 흔히 사용됩니다. 같은 자산이라도 거래소와 시간대에 따라 유동성이 크게 다를 수 있습니다.

## 메이커와 테이커
지정가 주문으로 호가창에 유동성을 공급하면 메이커, 시장가 주문으로 유동성을 소비하면 테이커로 분류됩니다. 많은 거래소가 메이커에게 더 낮은 수수료를 적용하는 구조를 갖고 있습니다.

## 정리
호가창과 유동성 개념은 체결 품질을 이해하는 기초 지표입니다. 본 자료는 교육 목적이며 특정 거래 행동을 권장하지 않습니다.`,
      en: `## Order book structure
An order book lists buy orders (bids) and sell orders (asks) stacked by price. The gap between the best bid and best ask is the spread; a narrower spread is read as a lower implicit cost of trading immediately.

## Slippage
When a large order consumes multiple price levels, the average fill price can end up worse than expected — this is slippage. Slippage tends to grow in thin markets and during volatile moments.

## What liquidity means
Liquidity is the degree to which an asset can be bought or sold without moving its price. Volume, order-book depth, and spread are common gauges. The same asset can have very different liquidity across venues and times of day.

## Makers and takers
Limit orders that add liquidity are maker orders; market orders that consume it are taker orders. Many exchanges charge makers lower fees.

## Note
Order-book and liquidity concepts are foundational for understanding execution quality. This material is educational and does not recommend any trading behavior.`,
    },
  ),
  L(
    'trading-derivatives-structure',
    'trading',
    'advanced',
    10,
    { ko: '파생상품의 구조와 리스크', en: 'Derivatives: Structure and Risks' },
    {
      ko: '무기한 선물, 펀딩비, 레버리지와 청산 메커니즘을 구조적으로 설명합니다.',
      en: 'Perpetual futures, funding rates, leverage, and liquidation mechanics.',
    },
    {
      ko: `## 무기한 선물이란
무기한 선물(퍼페추얼)은 만기가 없는 파생상품으로, 현물 가격을 추종하도록 펀딩비 메커니즘이 설계되어 있습니다. 시장 가격이 현물보다 높으면 롱 포지션이 숏 포지션에 펀딩비를 지불하는 식으로 가격 수렴을 유도합니다.

## 레버리지의 양면
레버리지는 증거금 대비 큰 포지션을 여는 것을 가능하게 하지만, 손익이 동일한 배율로 확대됩니다. 높은 레버리지는 작은 가격 변동에도 증거금이 소진될 수 있는 구조라는 점이 반복적으로 관찰됩니다.

## 청산 메커니즘
포지션의 손실이 유지증거금 수준에 도달하면 거래소가 강제로 포지션을 종료하는데, 이를 청산이라고 합니다. 변동성이 큰 구간에서는 연쇄 청산이 가격 변동을 증폭시키는 사례가 보고되곤 합니다. 온체인·거래소 데이터에서 청산 규모는 시장 과열도를 가늠하는 참고 지표로 활용됩니다.

## 펀딩비 읽기
펀딩비가 지속적으로 양수이면 롱 수요가 우세한 상태로, 음수이면 숏 수요가 우세한 상태로 해석되는 경향이 있습니다. 다만 펀딩비 단독으로 방향을 판단하기 어렵다는 점도 함께 언급됩니다.

## 정리
파생상품은 구조적으로 위험이 증폭되는 도구입니다. 본 자료는 메커니즘 설명을 위한 교육 콘텐츠이며 파생상품 이용을 권장하지 않습니다.`,
      en: `## What perpetual futures are
Perpetuals are derivatives without expiry, designed to track spot prices through a funding-rate mechanism. When the contract trades above spot, longs pay shorts, nudging prices back toward convergence.

## The two sides of leverage
Leverage lets a position exceed its margin, but gains and losses scale by the same multiple. It is repeatedly observed that high leverage means small price moves can exhaust margin.

## Liquidation mechanics
When a position's loss reaches the maintenance-margin threshold, the exchange force-closes it — a liquidation. In volatile stretches, cascading liquidations have been reported to amplify moves. Liquidation volumes are often used as a reference gauge of market froth.

## Reading funding rates
Persistently positive funding tends to be read as long-demand dominance, negative as short-demand dominance — with the caveat that funding alone is considered insufficient for directional judgment.

## Note
Derivatives structurally amplify risk. This is educational content explaining mechanisms; it does not encourage derivatives use.`,
    },
  ),

  // --- Technical Analysis ----------------------------------------------------
  L(
    'technical-chart-reading',
    'technical',
    'beginner',
    6,
    { ko: '차트 읽기 첫걸음', en: 'Reading Charts: First Steps' },
    {
      ko: '캔들의 구성, 타임프레임, 거래량의 기본 개념을 소개합니다.',
      en: 'Candle anatomy, timeframes, and volume fundamentals.',
    },
    {
      ko: `## 캔들의 구성
캔들 하나는 정해진 기간의 시가, 고가, 저가, 종가를 표현합니다. 몸통은 시가와 종가 사이, 꼬리는 그 기간의 최고·최저 도달 범위를 나타냅니다. 몸통과 꼬리의 상대적 크기에서 해당 기간의 매수·매도 압력을 읽으려는 시도가 기술적 분석의 출발점입니다.

## 타임프레임
같은 자산도 1시간봉과 일봉에서 전혀 다른 그림을 보일 수 있습니다. 짧은 타임프레임은 노이즈가 많고, 긴 타임프레임은 반응이 느린 특성이 있다고 설명됩니다. 분석가들은 보통 여러 타임프레임을 함께 살펴봅니다.

## 거래량의 역할
거래량은 해당 기간에 얼마나 많은 거래가 있었는지를 보여줍니다. 가격 움직임이 큰 거래량과 동반될 때 그 움직임의 신뢰도가 높다고 해석되는 경향이 있으며, 거래량 없는 급등락은 지속성이 약한 경우가 관찰되곤 합니다.

## 차트는 과거의 기록
차트는 이미 일어난 일의 기록이며, 미래를 보장하지 않습니다. 기술적 분석은 확률적 참고 도구로 접근하는 것이 일반적인 관점입니다.

## 정리
본 레슨은 차트의 구성 요소를 설명하는 교육 자료입니다.`,
      en: `## Candle anatomy
One candle shows the open, high, low, and close of a fixed period. The body spans open to close; the wicks mark the period's extremes. Reading buying and selling pressure from the relative size of bodies and wicks is where technical analysis begins.

## Timeframes
The same asset can look completely different on hourly versus daily candles. Shorter timeframes carry more noise; longer ones respond slowly. Analysts commonly examine multiple timeframes together.

## The role of volume
Volume shows how much trading occurred in a period. Price moves accompanied by heavy volume tend to be read as more reliable, while low-volume spikes are often observed to lack follow-through.

## Charts record the past
A chart is a record of what already happened — it guarantees nothing about the future. Treating technical analysis as a probabilistic reference tool is the mainstream view.

## Note
This lesson is educational material explaining chart components.`,
    },
  ),
  L(
    'technical-trend-sr',
    'technical',
    'intermediate',
    8,
    { ko: '추세, 지지와 저항', en: 'Trends, Support and Resistance' },
    {
      ko: '추세의 정의, 지지·저항 레벨의 형성 원리와 이동평균의 활용을 다룹니다.',
      en: 'Defining trends, how S/R levels form, and using moving averages.',
    },
    {
      ko: `## 추세의 정의
상승 추세는 고점과 저점이 모두 높아지는 구조, 하락 추세는 모두 낮아지는 구조로 정의됩니다. 뚜렷한 구조가 없으면 횡보로 분류합니다. 추세 판별은 타임프레임에 따라 달라질 수 있다는 점이 중요합니다.

## 지지와 저항
지지는 하락하던 가격이 반복적으로 멈춘 구간, 저항은 상승하던 가격이 반복적으로 막힌 구간입니다. 많은 참여자가 같은 가격대를 기억하고 반응하기 때문에 형성된다는 설명이 일반적입니다. 터치 횟수가 많을수록 해당 레벨의 유의미성이 높다고 해석되곤 하며, 돌파된 저항이 지지로 바뀌는 역할 전환도 자주 관찰됩니다.

## 이동평균
이동평균(MA)은 일정 기간 종가의 평균을 이어 그린 선으로, 추세의 방향과 기울기를 부드럽게 보여줍니다. 단기 이동평균이 장기 이동평균을 상향 돌파하는 현상(골든크로스)은 추세 전환의 참고 신호로 언급되지만, 후행 지표라는 한계도 함께 거론됩니다.

## 확률적 접근
지지·저항과 추세선은 절대적 경계가 아니라 확률적 참고 구간입니다. 같은 차트에서도 분석가마다 다른 레벨을 그릴 수 있습니다.

## 정리
본 자료는 개념 설명을 위한 교육 콘텐츠입니다.`,
      en: `## Defining a trend
An uptrend is a structure of higher highs and higher lows; a downtrend the opposite; no clear structure is a range. Trend classification can differ by timeframe — an important caveat.

## Support and resistance
Support is where declining prices repeatedly stopped; resistance is where rallies repeatedly stalled. The common explanation is that many participants remember and react to the same price areas. More touches are read as more significance, and broken resistance frequently flips into support.

## Moving averages
A moving average (MA) draws the average close over a window, smoothing trend direction and slope. A short MA crossing above a long one (a golden cross) is cited as a trend-change reference — with the caveat that MAs are lagging indicators.

## A probabilistic lens
S/R levels and trendlines are probabilistic reference zones, not hard boundaries. Different analysts may draw different levels on the same chart.

## Note
This material is educational content explaining concepts.`,
    },
  ),
  L(
    'technical-patterns-probability',
    'technical',
    'advanced',
    10,
    { ko: '패턴과 확률적 사고', en: 'Patterns and Probabilistic Thinking' },
    {
      ko: '차트 패턴을 확률의 언어로 해석하는 방법과 백테스트의 함정을 다룹니다.',
      en: 'Interpreting chart patterns probabilistically and the pitfalls of backtesting.',
    },
    {
      ko: `## 패턴은 경향이지 법칙이 아니다
삼각형, 깃발, 이중 바닥 같은 패턴은 과거에 특정 방향으로 이어진 '경향'이 보고된 형태들입니다. 그러나 어떤 패턴도 매번 같은 결과로 이어지지 않으며, 실패 사례도 항상 존재합니다. 패턴을 "이렇게 되면 반드시 오른다"가 아니라 "역사적으로 이런 분포가 관찰되었다"로 읽는 것이 확률적 사고입니다.

## 표본과 기저율
패턴의 성공률을 말하려면 정의가 일관된 큰 표본이 필요합니다. 패턴의 시작과 끝을 어디로 보느냐에 따라 같은 차트도 다르게 분류되며, 이 자의성이 성공률 통계를 크게 흔듭니다. 기저율(전체 상승/하락 확률)과 비교하지 않은 성공률은 과장되기 쉽다는 지적이 많습니다.

## 백테스트의 함정
과거 데이터에 맞춰 규칙을 다듬다 보면 그 데이터에만 잘 맞는 과최적화가 발생합니다. 미래 데이터로 검증(아웃오브샘플)하지 않은 백테스트 결과는 신뢰도가 낮다고 평가됩니다. 거래 비용과 슬리피지를 반영하지 않은 시뮬레이션도 흔한 오류로 꼽힙니다.

## 신뢰도 점수의 의미
자동 패턴 감지 도구의 신뢰도 점수는 '형태가 기준에 얼마나 부합하는가'를 뜻할 뿐, 방향이나 수익 확률이 아닙니다. 이 구분을 유지하는 것이 도구를 건강하게 사용하는 방법으로 제시됩니다.

## 정리
본 자료는 분석 방법론에 대한 교육 콘텐츠이며 특정 기법의 사용을 권장하지 않습니다.`,
      en: `## Patterns are tendencies, not laws
Triangles, flags, and double bottoms are shapes for which directional tendencies have been reported historically. No pattern resolves the same way every time; failure cases always exist. Probabilistic thinking reads a pattern as "this distribution was observed historically," never as "this must go up."

## Samples and base rates
Claiming a pattern's success rate requires a large, consistently defined sample. Where a pattern starts and ends is partly subjective, and that subjectivity moves the statistics substantially. Success rates not compared against base rates (the overall odds of up/down moves) are widely noted to overstate significance.

## Backtesting pitfalls
Tuning rules to fit past data produces overfitting — rules that work only on that data. Backtests without out-of-sample validation are considered low-confidence, and simulations that ignore fees and slippage are a common error.

## What confidence scores mean
An automated detector's confidence score expresses how well a shape matches criteria — not direction, not profit odds. Maintaining that distinction is presented as the healthy way to use such tools.

## Note
This is educational content about methodology; it does not encourage the use of any specific technique.`,
    },
  ),

  // --- Risk Management ---------------------------------------------------------
  L(
    'risk-why-first',
    'risk',
    'beginner',
    6,
    { ko: '리스크 관리가 먼저인 이유', en: 'Why Risk Management Comes First' },
    {
      ko: '변동성의 의미, 감당 가능한 금액의 원칙, 복리적 손실의 수학을 소개합니다.',
      en: 'Volatility, the affordable-amount principle, and the math of compounding losses.',
    },
    {
      ko: `## 변동성이라는 전제
암호화폐 시장은 전통 자산 대비 큰 변동성을 보여 왔습니다. 하루 10% 이상의 등락도 드물지 않게 기록되어 왔으며, 이 변동성은 기회와 위험이 같은 크기로 존재함을 의미합니다.

## 손실의 수학
50% 손실을 복구하려면 100% 상승이 필요합니다. 손실이 깊어질수록 복구에 필요한 상승률은 비대칭적으로 커지는데, 이 단순한 산수가 리스크 관리를 먼저 고려해야 하는 핵심 이유로 제시됩니다.

## 감당 가능한 금액의 원칙
잃어도 생활에 영향이 없는 범위 안에서만 위험 자산에 노출한다는 원칙은 가장 널리 공유되는 기본기입니다. 이는 특정 금액을 권하는 것이 아니라, 각자의 상황에 따라 스스로 판단할 기준선을 제안하는 개념입니다.

## 분산의 기초
하나의 자산·하나의 시점에 집중된 노출은 단일 사건의 영향에 그대로 노출됩니다. 자산·시점을 나누는 분산은 개별 사건의 충격을 줄이는 고전적 방법으로 설명됩니다.

## 정리
수익을 계획하기 전에 손실 시나리오를 먼저 그려 보는 접근이 리스크 관리의 출발점으로 소개됩니다. 본 자료는 교육 목적이며 개인별 자문이 아닙니다.`,
      en: `## Volatility as the premise
Crypto markets have shown large volatility relative to traditional assets — double-digit daily swings have not been rare. That volatility means opportunity and risk exist at the same scale.

## The math of losses
Recovering a 50% loss requires a 100% gain. The deeper the loss, the disproportionately larger the recovery required — this simple arithmetic is the core argument for putting risk management first.

## The affordable-amount principle
Limiting risk-asset exposure to what one could lose without affecting daily life is the most widely shared fundamental. It prescribes no specific amount; it proposes a personal baseline each person defines for themselves.

## Diversification basics
Exposure concentrated in one asset at one moment absorbs single events at full force. Spreading across assets and time is the classic way to blunt individual shocks.

## Note
Sketching loss scenarios before planning gains is presented as the starting point of risk management. This material is educational, not personal advice.`,
    },
  ),
  L(
    'risk-position-sizing',
    'risk',
    'intermediate',
    8,
    { ko: '포지션 사이징과 분산', en: 'Position Sizing and Diversification' },
    {
      ko: '고정 비율 개념, 상관관계, 집중도 지표(HHI)를 통한 배분 이해를 다룹니다.',
      en: 'Fixed-fraction concepts, correlation, and reading allocation via concentration metrics.',
    },
    {
      ko: `## 포지션 사이징이란
포지션 사이징은 한 번의 노출 규모를 정하는 규칙입니다. 총자산의 일정 비율만 단일 아이디어에 배정하는 고정 비율 방식이 널리 알려져 있으며, 어떤 비율이 적절한지는 각자의 변동성 허용도에 따라 달라지는 개인적 판단 영역으로 남습니다.

## 상관관계의 함정
서로 다른 자산이라도 함께 움직이면 분산 효과는 제한적입니다. 암호화폐 자산 다수는 비트코인과 높은 상관관계를 보이는 기간이 관찰되어 왔기 때문에, 종목 수가 많다는 사실만으로 분산이 되었다고 보기 어렵다는 지적이 있습니다.

## 집중도 지표 읽기
허핀달 지수(HHI)는 각 자산 비중의 제곱을 합한 값으로, 배분이 소수 자산에 몰린 정도를 수치화합니다. 유효 자산 수(1/HHI)는 현재 배분을 동일 비중으로 환산하면 몇 개 자산과 같은지 보여줍니다. 이런 지표는 배분 구조를 객관적으로 관찰하는 도구로 활용됩니다.

## 리밸런싱이라는 개념
목표 비중에서 멀어진 배분을 다시 맞추는 행위를 리밸런싱이라고 부릅니다. 실행 여부와 주기는 각자의 전략과 비용 구조에 따라 달라지는 선택의 문제로 설명됩니다.

## 정리
본 자료는 배분 관련 개념을 설명하는 교육 콘텐츠이며, 특정 비율이나 행동을 권장하지 않습니다.`,
      en: `## What position sizing is
Position sizing is the rule for how large any single exposure gets. Fixed-fraction approaches — allocating only a set percentage of capital to one idea — are widely known, while the right percentage remains a personal judgment tied to one's volatility tolerance.

## The correlation trap
Different assets that move together provide limited diversification. Many crypto assets have shown high correlation to bitcoin for extended periods, so holding many names is not, by itself, evidence of diversification.

## Reading concentration metrics
The Herfindahl index (HHI) sums squared weights, quantifying how concentrated an allocation is. Effective assets (1/HHI) expresses the allocation as its equal-weight equivalent. Such metrics serve as objective lenses on allocation structure.

## The concept of rebalancing
Bringing an allocation back toward target weights is called rebalancing. Whether and how often to do it is described as a choice depending on one's strategy and cost structure.

## Note
This content explains allocation concepts educationally; it does not recommend any ratio or action.`,
    },
  ),
  L(
    'risk-drawdown-metrics',
    'risk',
    'advanced',
    10,
    { ko: '드로다운과 리스크 지표', en: 'Drawdowns and Risk Metrics' },
    {
      ko: '최대 낙폭, 변동성 측정, VaR의 개념과 한계를 설명합니다.',
      en: 'Max drawdown, volatility measurement, and the concept and limits of VaR.',
    },
    {
      ko: `## 최대 낙폭(MDD)
최대 낙폭은 고점에서 저점까지의 최대 하락률로, 전략이나 자산이 겪은 최악의 구간을 요약합니다. 같은 수익률이라도 낙폭 경로가 다르면 체감 위험은 전혀 다르다는 점에서, MDD는 수익률과 함께 보아야 할 지표로 제시됩니다.

## 변동성 측정
수익률의 표준편차는 가장 기본적인 변동성 지표입니다. 다만 상승 변동성과 하락 변동성을 구분하지 않는 한계가 있어, 하락만 계산하는 하방 편차 같은 보완 지표도 함께 사용됩니다.

## VaR의 개념과 한계
VaR(Value at Risk)는 "정상적인 시장에서 주어진 신뢰수준으로 일정 기간 내 발생할 수 있는 최대 손실"을 추정하는 지표입니다. 그러나 VaR는 꼬리 사건(극단적 손실)의 크기를 말해주지 않으며, 과거 분포가 미래에도 유효하다는 가정에 의존한다는 비판이 꾸준히 제기됩니다. 암호화폐처럼 분포의 꼬리가 두꺼운 시장에서는 이 한계가 더 크게 작용할 수 있다고 평가됩니다.

## 지표는 계기판이다
리스크 지표는 자동차의 계기판처럼 상태를 보여줄 뿐, 운전을 대신하지 않습니다. 지표의 정의와 한계를 이해하고 여러 지표를 함께 보는 접근이 일반적으로 권장되는 관점입니다.

## 정리
본 자료는 지표의 개념과 한계를 다루는 교육 콘텐츠입니다.`,
      en: `## Maximum drawdown (MDD)
Max drawdown is the largest peak-to-trough decline, summarizing the worst stretch an asset or strategy endured. Identical returns with different drawdown paths feel entirely different — which is why MDD is presented alongside returns.

## Measuring volatility
The standard deviation of returns is the baseline volatility metric. Because it does not distinguish upside from downside movement, complements like downside deviation (counting only declines) are used as well.

## VaR: concept and limits
Value at Risk estimates "the maximum loss expected over a period at a given confidence level in normal markets." Criticisms persist: VaR says nothing about the size of tail events beyond the threshold, and it assumes past distributions remain valid. In fat-tailed markets like crypto, these limits are assessed to matter more.

## Metrics are a dashboard
Risk metrics display conditions the way a car's dashboard does — they do not drive. Understanding each metric's definition and limits, and reading several together, is the commonly recommended stance.

## Note
This is educational content covering metric concepts and their limits.`,
    },
  ),

  // --- Psychology -----------------------------------------------------------------
  L(
    'psychology-traps',
    'psychology',
    'beginner',
    6,
    { ko: '투자 심리의 함정', en: 'Psychological Traps in Markets' },
    {
      ko: 'FOMO, 손실 회피, 군중 심리가 의사결정을 어떻게 왜곡하는지 소개합니다.',
      en: 'How FOMO, loss aversion, and herd behavior distort decisions.',
    },
    {
      ko: `## FOMO — 놓침에 대한 공포
가격이 급등할 때 "나만 놓치고 있다"는 감각은 계획에 없던 진입을 유발하는 대표적 심리로 알려져 있습니다. 급등 후 추격 진입이 고점 근처 매수로 이어진 사례는 시장 역사에서 반복적으로 관찰됩니다.

## 손실 회피
행동경제학 연구는 같은 크기의 손실이 이익보다 약 두 배 크게 느껴진다고 보고합니다. 이 비대칭은 손실 확정을 미루고 이익은 서둘러 확정하는 행동으로 이어지곤 하며, "손실은 길게, 이익은 짧게" 가져가는 역설을 만든다고 설명됩니다.

## 군중 심리
모두가 사는 시장에서는 낙관이, 모두가 파는 시장에서는 공포가 전염됩니다. 공포·탐욕 지수 같은 심리 지표는 이런 집단 정서를 수치화하려는 시도입니다. 극단적 정서 구간이 전환점과 겹치는 경우가 역사적으로 관찰되었지만, 시점 특정은 어렵다는 한계도 함께 언급됩니다.

## 자각이 첫걸음
편향은 없앨 수 없지만, 자신이 어떤 상황에서 어떤 편향에 취약한지 아는 것만으로 영향이 줄어든다는 견해가 일반적입니다.

## 정리
본 자료는 심리적 편향을 소개하는 교육 콘텐츠입니다.`,
      en: `## FOMO — fear of missing out
The sense that "everyone but me is profiting" during sharp rallies is a well-known driver of unplanned entries. Chasing after a surge has repeatedly coincided with buying near local tops throughout market history.

## Loss aversion
Behavioral research reports that losses feel roughly twice as large as equal-sized gains. This asymmetry tends to delay realizing losses while rushing to lock in gains — producing the paradox of holding losers long and winners short.

## Herd behavior
Optimism spreads in markets where everyone is buying; fear spreads where everyone is selling. Sentiment gauges like the Fear & Greed index attempt to quantify this collective mood. Historically, emotional extremes have sometimes overlapped with turning points — though timing them precisely is noted to be difficult.

## Awareness is the first step
Biases cannot be eliminated, but the common view is that simply knowing which situations make you vulnerable reduces their pull.

## Note
This is educational content introducing psychological biases.`,
    },
  ),
  L(
    'psychology-biases-decisions',
    'psychology',
    'intermediate',
    8,
    { ko: '편향과 의사결정', en: 'Biases and Decision-Making' },
    {
      ko: '확증 편향, 앵커링, 사후 확신 편향과 기록(저널링)의 효과를 다룹니다.',
      en: 'Confirmation bias, anchoring, hindsight bias, and the value of journaling.',
    },
    {
      ko: `## 확증 편향
사람은 이미 가진 견해를 지지하는 정보를 더 쉽게 받아들이고, 반대 증거는 평가절하하는 경향이 있습니다. 시장에서는 보유 자산에 대한 낙관적 뉴스만 소비하는 형태로 나타나곤 합니다. 반대 논거를 의도적으로 찾아보는 습관이 보완책으로 제시됩니다.

## 앵커링
처음 접한 숫자가 이후 판단의 기준점이 되는 현상입니다. "고점 대비 70% 하락했으니 싸다"는 판단은 과거 고점이라는 앵커에 의존한 것으로, 현재 가치와는 무관할 수 있다는 지적이 있습니다.

## 사후 확신 편향
결과를 알고 나면 "그럴 줄 알았다"고 느끼는 편향입니다. 이 편향은 과거 판단의 품질을 과대평가하게 만들어 학습을 방해한다고 설명됩니다.

## 기록의 힘
진입·청산의 이유를 결과가 나오기 전에 기록하는 저널링은 사후 확신 편향을 차단하는 실용적 도구로 알려져 있습니다. 시간이 쌓이면 자신의 반복 패턴이 데이터로 드러나고, 감정 상태와 판단 품질의 상관도 관찰할 수 있게 됩니다.

## 정리
본 자료는 인지 편향과 기록 습관을 설명하는 교육 콘텐츠입니다.`,
      en: `## Confirmation bias
People accept information supporting their existing views more readily and discount contrary evidence. In markets this often looks like consuming only optimistic news about held assets. Deliberately seeking the opposing case is the standard countermeasure.

## Anchoring
The first number encountered becomes the reference point for later judgments. "It's down 70% from the high, so it's cheap" leans on the old high as an anchor — which may say nothing about present value.

## Hindsight bias
Once outcomes are known, they feel like they were predictable all along. This bias inflates the perceived quality of past judgments and is described as a barrier to learning.

## The power of journaling
Writing down the reasons for a decision before its outcome is known is a practical tool against hindsight bias. Over time, journals surface one's recurring patterns as data — including correlations between emotional state and decision quality.

## Note
This is educational content on cognitive biases and record-keeping habits.`,
    },
  ),
  L(
    'psychology-discipline-systems',
    'psychology',
    'advanced',
    10,
    { ko: '규율과 시스템', en: 'Discipline and Systems' },
    {
      ko: '과정 중심 사고, 계획 준수, 감정 상태 관리의 프레임워크를 다룹니다.',
      en: 'Process-oriented thinking, plan adherence, and frameworks for emotional state.',
    },
    {
      ko: `## 결과가 아니라 과정
좋은 판단이 나쁜 결과로, 나쁜 판단이 좋은 결과로 이어지는 일은 확률적 환경에서 흔합니다. 결과만으로 판단을 평가하면 운과 실력이 뒤섞입니다. 과정 중심 사고는 "판단 시점에 알 수 있었던 정보로 좋은 결정이었는가"를 묻는 프레임워크로 소개됩니다.

## 계획과 실행의 분리
분석과 계획은 감정이 개입되기 전, 시장이 움직이기 전에 이루어지는 것이 이상적이라고 설명됩니다. 실행 단계에서 계획을 수정하고 싶은 충동은 대부분 감정에서 비롯된다는 관찰이 있으며, 계획 변경은 정해진 검토 시점에만 하는 규칙이 보완책으로 제시됩니다.

## 감정 상태의 관리
피로, 연속 손실, 큰 이익 직후는 판단 품질이 흔들리기 쉬운 상태로 알려져 있습니다. 이런 상태를 인지했을 때 의사결정 자체를 미루는 것도 하나의 시스템입니다. 체크리스트는 항공·의료 분야에서 검증된 도구로, 상태 점검을 습관화하는 데 활용됩니다.

## 시스템이 규율을 대신한다
의지력은 소모 자원이라는 연구 결과가 있습니다. 매 순간 의지로 버티는 대신, 좋은 행동이 기본값이 되도록 환경과 절차를 설계하는 접근이 지속 가능하다고 평가됩니다.

## 정리
본 자료는 의사결정 프레임워크를 설명하는 교육 콘텐츠입니다.`,
      en: `## Process over outcomes
In probabilistic environments, good decisions produce bad outcomes and vice versa all the time. Judging decisions by results alone mixes luck with skill. Process-oriented thinking asks instead: "was this a good decision given what was knowable at the time?"

## Separating planning from execution
Ideally, analysis and planning happen before emotions engage and before the market moves. The urge to modify a plan mid-execution is observed to stem mostly from emotion; restricting plan changes to scheduled review points is the standard safeguard.

## Managing emotional state
Fatigue, losing streaks, and the aftermath of large wins are known to degrade judgment. Deferring decisions upon noticing such states is itself a system. Checklists — proven in aviation and medicine — help make state checks habitual.

## Systems replace willpower
Research suggests willpower is a depletable resource. Designing environments and procedures where good behavior is the default is assessed as more sustainable than moment-to-moment discipline.

## Note
This is educational content describing decision frameworks.`,
    },
  ),
]

export function getLesson(slug: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.slug === slug)
}
