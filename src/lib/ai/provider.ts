import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Provider-agnostic AI interface for article analysis.
// AnthropicProvider is used when ANTHROPIC_API_KEY is set; otherwise the
// deterministic MockProvider keeps the pipeline fully functional in dev and
// tests (its outputs are labeled with aiModel "mock-v1").
// ---------------------------------------------------------------------------

export const articleAnalysisSchema = z.object({
  summary_ko: z.string(),
  summary_en: z.string(),
  sentiment: z.enum(['bullish', 'neutral', 'bearish']),
  confidence: z.number(),
})

export type ArticleAnalysis = z.infer<typeof articleAnalysisSchema>

export type AnalyzeInput = {
  title: string
  source: string
  category: string
}

// --- Market brief generation (stage 9) -------------------------------------

const localizedText = z.object({ ko: z.string(), en: z.string() })

export const briefSectionsSchema = z.object({
  btc: localizedText,
  eth: localizedText,
  altcoin: localizedText,
  macro: localizedText,
  today: localizedText,
})

export type BriefSectionsOutput = z.infer<typeof briefSectionsSchema>

export type BriefGenInput = {
  tier: 'standard' | 'detailed'
  date: string
  market: { id: string; name: string; price: number; changePct: number }[]
  fearGreed: { value: number; classification: string } | null
  headlines: { title: string; category: string; sentiment: string | null }[]
  /** Non-production test hook for the mock provider. */
  mockScenario?: string
}

// --- Portfolio educational commentary (stage 11, principle A-2-7) ----------
// Privacy: input carries structural metrics only (weights %, indices) —
// never monetary amounts or user identifiers.

export const portfolioCommentarySchema = z.object({
  ko: z.string(),
  en: z.string(),
})

export type PortfolioCommentary = z.infer<typeof portfolioCommentarySchema>

export type PortfolioExplainInput = {
  weights: { symbol: string; weightPct: number }[]
  hhi: number
  effectiveAssets: number
  topSymbol: string
  topWeightPct: number
  concentration: 'diversified' | 'moderate' | 'concentrated'
  /** Non-production test hook for the mock provider. */
  mockScenario?: string
}

// --- Premium research reports (stage 14) ------------------------------------

export const reportContentSchema = z.object({
  title: z.object({ ko: z.string(), en: z.string() }),
  summary: z.object({ ko: z.string(), en: z.string() }),
  content: z.object({ ko: z.string(), en: z.string() }),
})

export type ReportContent = z.infer<typeof reportContentSchema>

export type ReportGenInput = {
  category: 'ETF' | 'MACRO' | 'ONCHAIN'
  cadence: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
  periodKey: string
  market: { id: string; name: string; price: number; changePct: number }[]
  fearGreed: { value: number; classification: string } | null
  headlines: { title: string; category: string }[]
  network: {
    activeAddresses: number | null
    transactions: number | null
    hashRateEh: number | null
    minerRevenueUsd: number | null
  }
  stablecoins: { symbol: string; marketCapB: number }[]
  /** Non-production test hook for the mock provider. */
  mockScenario?: string
}

export interface AiProvider {
  /** Model label persisted with each result (AI-generated content label). */
  readonly model: string
  analyzeArticle(input: AnalyzeInput): Promise<ArticleAnalysis>
  generateBrief(input: BriefGenInput): Promise<BriefSectionsOutput>
  explainPortfolio(input: PortfolioExplainInput): Promise<PortfolioCommentary>
  generateReport(input: ReportGenInput): Promise<ReportContent>
}

export class AiRateLimitError extends Error {}

// ---------------------------------------------------------------------------
// Anthropic (Claude) provider
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You analyze crypto news headlines for an informational platform (not an advisory service).

Rules:
- Ground everything strictly in the given headline. Do not invent facts, numbers, price targets, or events.
- Never give investment advice, buy/sell recommendations, or profit promises. Neutral, factual tone.
- summary_ko: 1-2 sentences in Korean (roughly 60-200 characters) restating and lightly contextualizing the headline.
- summary_en: the same in English (roughly 60-250 characters).
- sentiment: the TONE of the news itself — "bullish", "neutral", or "bearish".
- confidence: 0-100, how clearly that tone reads from the headline (ambiguous → low).`

class AnthropicProvider implements AiProvider {
  readonly model: string
  private readonly client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
    this.model = process.env.AI_MODEL ?? 'claude-opus-4-8'
  }

  async analyzeArticle(input: AnalyzeInput): Promise<ArticleAnalysis> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Headline: ${input.title}\nSource: ${input.source}\nCategory: ${input.category}`,
          },
        ],
        output_config: { format: zodOutputFormat(articleAnalysisSchema) },
      })
      if (!response.parsed_output) {
        throw new Error('model returned unparseable output')
      }
      return response.parsed_output
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new AiRateLimitError('anthropic rate limited')
      }
      throw error
    }
  }

  async generateBrief(input: BriefGenInput): Promise<BriefSectionsOutput> {
    const lengthGuide =
      input.tier === 'detailed'
        ? 'Each section: 4-7 sentences with deeper context (drivers, on-chain/derivatives angles where relevant, what to watch).'
        : 'Each section: 2-3 concise sentences.'

    const marketLines = input.market
      .map((m) => `${m.id} (${m.name}): $${m.price} (${m.changePct.toFixed(2)}% 24h)`)
      .join('\n')
    const headlineLines = input.headlines
      .map((h) => `- [${h.category}${h.sentiment ? `/${h.sentiment}` : ''}] ${h.title}`)
      .join('\n')

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: input.tier === 'detailed' ? 4000 : 2000,
        system: BRIEF_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Date: ${input.date} (UTC)
Tier: ${input.tier}. ${lengthGuide}

Market data:
${marketLines || '(unavailable — say so where relevant)'}

Fear & Greed index: ${input.fearGreed ? `${input.fearGreed.value} (${input.fearGreed.classification})` : 'unavailable'}

Recent headlines (last 24h):
${headlineLines || '(none)'}

Write the five sections (btc, eth, altcoin, macro, today) in BOTH Korean (ko) and English (en).`,
          },
        ],
        output_config: { format: zodOutputFormat(briefSectionsSchema) },
      })
      if (!response.parsed_output) {
        throw new Error('model returned unparseable output')
      }
      return response.parsed_output
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new AiRateLimitError('anthropic rate limited')
      }
      throw error
    }
  }

  async explainPortfolio(input: PortfolioExplainInput): Promise<PortfolioCommentary> {
    const weightLines = input.weights
      .map((w) => `${w.symbol}: ${w.weightPct.toFixed(1)}%`)
      .join(', ')
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1200,
        system: PORTFOLIO_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Allocation weights: ${weightLines}
HHI: ${input.hhi.toFixed(3)}
Effective number of assets: ${input.effectiveAssets.toFixed(2)}
Largest position: ${input.topSymbol} at ${input.topWeightPct.toFixed(1)}%
Concentration label: ${input.concentration}

Explain what these diversification metrics mean, educationally.`,
          },
        ],
        output_config: { format: zodOutputFormat(portfolioCommentarySchema) },
      })
      if (!response.parsed_output) throw new Error('model returned unparseable output')
      return response.parsed_output
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new AiRateLimitError('anthropic rate limited')
      }
      throw error
    }
  }

  async generateReport(input: ReportGenInput): Promise<ReportContent> {
    const marketLines = input.market
      .map((m) => `${m.id}: $${m.price} (${m.changePct.toFixed(2)}% 24h)`)
      .join('\n')
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 6000,
        system: REPORT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Report type: ${input.category} / cadence: ${input.cadence} / period: ${input.periodKey}

Market data:
${marketLines || '(unavailable)'}
Fear & Greed: ${input.fearGreed ? `${input.fearGreed.value} (${input.fearGreed.classification})` : 'unavailable'}
Network: active addresses ${input.network.activeAddresses ?? 'N/A'}, daily txs ${input.network.transactions ?? 'N/A'}, hash rate ${input.network.hashRateEh ?? 'N/A'} EH/s, miner revenue $${input.network.minerRevenueUsd ?? 'N/A'}
Stablecoins: ${input.stablecoins.map((s) => `${s.symbol} $${s.marketCapB}B`).join(', ') || 'N/A'}
Recent headlines:
${input.headlines.map((h) => `- [${h.category}] ${h.title}`).join('\n') || '(none)'}

Write the ${input.cadence.toLowerCase()} ${input.category} research report in BOTH Korean (ko) and English (en). Markdown content with ## section headings, 500-900 words per language.`,
          },
        ],
        output_config: { format: zodOutputFormat(reportContentSchema) },
      })
      if (!response.parsed_output) throw new Error('model returned unparseable output')
      return response.parsed_output
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new AiRateLimitError('anthropic rate limited')
      }
      throw error
    }
  }
}

const REPORT_SYSTEM_PROMPT = `You write periodic crypto research reports for an informational platform (not an advisory service). Reports are published identically to all subscribers — never personalized.

Hard rules:
- Ground every statement in the provided data and headlines. No invented facts, figures, or events.
- NO definitive predictions; use probabilistic, hedged language throughout (Korean: "~할 가능성", "~로 보입니다"; English: "may", "could", "suggests").
- NO action directives (buy/sell/rebalance/enter/exit) and NO entry/target/stop levels.
- NO profit guarantees. Neutral, analytical tone. Information and education purpose only.

Report focus by type:
- ETF: spot/derivative ETF landscape, flows context from headlines, structural observations
- MACRO: rates, inflation, dollar, equity backdrop and their observed relation to crypto
- ONCHAIN: network activity, stablecoin supply, miner and whale context

Structure the markdown content with ## headings: 개요/Overview, 주요 관찰/Key observations, 데이터 하이라이트/Data highlights, 지켜볼 요소/What to watch, and a closing note that the report is informational.`

const PORTFOLIO_SYSTEM_PROMPT = `You explain portfolio diversification metrics for an educational, informational platform.

Hard rules (principle A-2-7):
- EXPLAIN the metrics only — what HHI, effective asset count, and concentration mean, and what the given values indicate descriptively.
- NEVER give advice or directives: no "rebalance", no "you should", no "we recommend", no "consider buying/selling/reducing", no suggestions to change the portfolio in any way.
- Do not predict prices or outcomes. Neutral, educational tone.
- The input contains percentages and index values only — do not invent amounts, currencies, or personal details.
- ko: 3-5 Korean sentences. en: 3-5 English sentences.`

const BRIEF_SYSTEM_PROMPT = `You write a daily crypto market brief for an informational platform (not an advisory service). It is published identically to all subscribers — never personalized.

Hard rules:
- Ground every statement in the provided market data and headlines only. No invented facts, numbers, or events.
- NO definitive predictions. Never state that a price WILL rise/fall/reach a level. Use probabilistic, hedged language in every section (Korean: "~할 가능성", "~수 있습니다", "~로 보입니다", "전망입니다"; English: "may", "could", "appears", "suggests", "likely").
- NO action directives. Never tell readers to buy, sell, enter, exit, or recommend any position.
- NO profit guarantees or risk-free claims.
- Neutral, analytical, factual tone. Information and education purpose only.

Sections:
- btc: Bitcoin price action and context
- eth: Ethereum price action and ecosystem context
- altcoin: notable altcoin/market-breadth observations (SOL and others from the data)
- macro: traditional markets / macro backdrop (indices, dollar, commodities)
- today: "Today's Market Brief" — a synthesis of the above with what to watch (events, levels framed as observations, not targets)`

// ---------------------------------------------------------------------------
// Mock provider — deterministic, key-free. Supports test markers:
//   [[MALFORMED]] in the title → returns garbage (exercises sanity checks)
//   [[ADVICE]]    in the title → returns a compliance-violating summary
// ---------------------------------------------------------------------------

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

class MockProvider implements AiProvider {
  readonly model = 'mock-v1'

  async analyzeArticle(input: AnalyzeInput): Promise<ArticleAnalysis> {
    if (input.title.includes('[[MALFORMED]]')) {
      // Simulates a broken model output: empty summary, out-of-range confidence.
      return {
        summary_ko: '',
        summary_en: 'x',
        sentiment: 'neutral',
        confidence: 999,
      }
    }
    if (input.title.includes('[[ADVICE]]')) {
      // Simulates a compliance violation the sanity filter must catch.
      return {
        summary_ko: '이 코인은 확실한 기회이니 지금 바로 매수하세요. 수익이 보장됩니다.',
        summary_en: 'This coin is a guaranteed profit — buy now before it is too late.',
        sentiment: 'bullish',
        confidence: 95,
      }
    }

    const hash = hashString(input.title)
    const sentiments = ['bullish', 'neutral', 'bearish'] as const
    const sentiment = sentiments[hash % 3]
    const confidence = 55 + (hash % 36) // 55–90
    const short = input.title.length > 90 ? `${input.title.slice(0, 87)}…` : input.title

    return {
      summary_ko: `${input.source} 보도에 따르면, "${short}" 관련 소식이 전해졌습니다. 시장 참여자들의 관심이 이어지는 모습입니다.`,
      summary_en: `According to ${input.source}, "${short}". Market participants are following the development.`,
      sentiment,
      confidence,
    }
  }

  async generateBrief(input: BriefGenInput): Promise<BriefSectionsOutput> {
    if (input.mockScenario === 'violation') {
      // Deliberately breaks every guideline — must be caught and HELD.
      const bad = {
        ko: '비트코인은 반드시 급등할 것입니다. 지금 바로 매수하세요. 수익이 보장됩니다.',
        en: 'Bitcoin will surge tomorrow. Buy now — guaranteed profit with zero risk.',
      }
      return { btc: bad, eth: bad, altcoin: bad, macro: bad, today: bad }
    }
    if (input.mockScenario === 'malformed') {
      const bad = { ko: '짧음', en: 'short' }
      return { btc: bad, eth: bad, altcoin: bad, macro: bad, today: bad }
    }

    const find = (id: string) => input.market.find((m) => m.id === id)
    const btc = find('BTC')
    const eth = find('ETH')
    const sol = find('SOL')
    const fng = input.fearGreed
    const dir = (pct?: number) =>
      pct === undefined ? '보합' : pct >= 0.5 ? '상승' : pct <= -0.5 ? '하락' : '보합'
    const dirEn = (pct?: number) =>
      pct === undefined ? 'flat' : pct >= 0.5 ? 'higher' : pct <= -0.5 ? 'lower' : 'flat'
    const price = (m?: { price: number }) => (m ? `$${Math.round(m.price).toLocaleString('en-US')}` : 'N/A')
    const pct = (m?: { changePct: number }) => (m ? `${m.changePct.toFixed(2)}%` : 'N/A')
    const detailed = input.tier === 'detailed'

    const extraKo = detailed
      ? ' 파생상품 포지션과 온체인 흐름을 함께 살펴보면, 단기 변동성 확대 가능성에 유의할 필요가 있어 보입니다. 주요 지지·저항 구간에서의 거래량 변화가 관전 포인트로 관측됩니다.'
      : ''
    const extraEn = detailed
      ? ' Derivatives positioning and on-chain flows suggest that short-term volatility could stay elevated, and volume behavior around key levels appears worth watching.'
      : ''

    const sections: BriefSectionsOutput = {
      btc: {
        ko: `비트코인은 ${price(btc)} 부근에서 24시간 기준 ${pct(btc)}의 ${dir(btc?.changePct)} 흐름을 보이고 있습니다. 현재 구간에서는 방향성 탐색이 이어질 가능성이 있어 보입니다.${extraKo}`,
        en: `Bitcoin is trading near ${price(btc)}, ${dirEn(btc?.changePct)} by ${pct(btc)} over 24h. Price action suggests the market may continue searching for direction around this range.${extraEn}`,
      },
      eth: {
        ko: `이더리움은 ${price(eth)} 수준에서 ${pct(eth)}의 변동을 기록 중입니다. 생태계 활동 지표와 함께 보면 수요 흐름이 유지될 가능성이 관측됩니다.${extraKo}`,
        en: `Ethereum stands near ${price(eth)} with a ${pct(eth)} 24h move. Ecosystem activity indicates demand could remain steady, though follow-through remains to be seen.${extraEn}`,
      },
      altcoin: {
        ko: `솔라나(${price(sol)}, ${pct(sol)})를 비롯한 주요 알트코인은 비트코인 흐름에 연동된 모습입니다. 시장 폭 지표를 감안하면 종목별 차별화가 이어질 수 있습니다.${extraKo}`,
        en: `Solana (${price(sol)}, ${pct(sol)}) and other major altcoins appear to track bitcoin's lead. Breadth suggests dispersion across names may persist.${extraEn}`,
      },
      macro: {
        ko: `전통 시장에서는 지수와 달러, 원자재 흐름이 위험자산 선호도에 영향을 줄 수 있는 상황입니다. 공포·탐욕 지수는 ${fng ? `${fng.value}(${fng.classification})` : '집계 불가'} 수준으로, 심리 지표상 신중한 접근이 시사됩니다.${extraKo}`,
        en: `In traditional markets, index, dollar and commodity moves could influence risk appetite. The Fear & Greed index reads ${fng ? `${fng.value} (${fng.classification})` : 'unavailable'}, suggesting sentiment remains a factor to watch.${extraEn}`,
      },
      today: {
        ko: `오늘의 마켓 브리핑: 주요 자산은 ${dir(btc?.changePct)} 흐름 속에 방향성을 모색하는 모습입니다. 최근 헤드라인(${input.headlines.length}건)을 감안하면 규제·매크로 이슈가 변동성 요인이 될 가능성이 있습니다. 데이터 기준으로는 주요 가격대 부근의 움직임을 지켜볼 필요가 있어 보입니다.${extraKo}`,
        en: `Today's market brief: major assets appear to be seeking direction amid ${dirEn(btc?.changePct)} tape. Given recent headlines (${input.headlines.length}), regulatory and macro developments could act as volatility catalysts. Watching behavior around key price areas seems warranted.${extraEn}`,
      },
    }
    return sections
  }

  async explainPortfolio(input: PortfolioExplainInput): Promise<PortfolioCommentary> {
    if (input.mockScenario === 'directive') {
      // Deliberately advisory — must be blocked by the portfolio guidelines.
      return {
        ko: `현재 포트폴리오의 ${input.topSymbol} 비중이 ${input.topWeightPct.toFixed(0)}%로 매우 높은 편입니다. 분산 지표(HHI ${input.hhi.toFixed(2)})를 개선하려면 지금 바로 리밸런싱하세요. 해당 자산의 비중을 줄이세요.`,
        en: `Your portfolio's ${input.topSymbol} weight is ${input.topWeightPct.toFixed(0)}%, which is very high for the HHI metric of ${input.hhi.toFixed(2)}. You should rebalance the allocation now, and we recommend reducing that position immediately.`,
      }
    }

    const labelKo =
      input.concentration === 'diversified'
        ? '분산형'
        : input.concentration === 'moderate'
          ? '보통'
          : '집중형'

    return {
      ko: `이 포트폴리오의 허핀달 지수(HHI)는 ${input.hhi.toFixed(3)}으로, 지표상 ${labelKo} 구간에 해당하는 것으로 관측됩니다. HHI는 각 자산 비중의 제곱을 합한 값으로, 숫자가 클수록 소수 자산에 대한 집중도가 높다는 뜻입니다. 유효 자산 수는 약 ${input.effectiveAssets.toFixed(1)}개로, 동일 비중 기준으로 환산한 분산 수준을 나타냅니다. 가장 큰 비중은 ${input.topSymbol}(${input.topWeightPct.toFixed(1)}%)로 집계되며, 이 수치는 배분 구조를 이해하는 참고 지표로 활용될 수 있습니다.`,
      en: `This portfolio's Herfindahl index (HHI) reads ${input.hhi.toFixed(3)}, which falls in the "${input.concentration}" range descriptively. HHI sums the squares of each asset's weight, so higher values indicate the allocation is concentrated in fewer assets. The effective number of assets is about ${input.effectiveAssets.toFixed(1)}, a way of expressing diversification as an equal-weight equivalent. The largest weight is ${input.topSymbol} at ${input.topWeightPct.toFixed(1)}%, a metric that may help in understanding the allocation structure.`,
    }
  }

  async generateReport(input: ReportGenInput): Promise<ReportContent> {
    if (input.mockScenario === 'violation') {
      const bad = '비트코인은 반드시 급등할 것입니다. 지금 매수하세요. 목표가는 10만 달러, 손절가는 5만 달러입니다. 수익이 보장됩니다.'
      const badEn = 'Bitcoin will surge — buy now with a target price of $100k and a stop-loss at $50k. Guaranteed profit.'
      return {
        title: {
          ko: `${input.category} ${input.periodKey} 리포트 — 지금 매수하세요`,
          en: `${input.category} ${input.periodKey} Report — buy now`,
        },
        summary: { ko: bad, en: badEn },
        content: { ko: `## 개요\n${bad}\n${bad}`, en: `## Overview\n${badEn}\n${badEn}` },
      }
    }

    const catKo = { ETF: 'ETF', MACRO: '매크로', ONCHAIN: '온체인' }[input.category]
    const cadKo = { WEEKLY: '주간', MONTHLY: '월간', QUARTERLY: '분기' }[input.cadence]
    const cadEn = { WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly' }[input.cadence]
    const btc = input.market.find((m) => m.id === 'BTC')
    const price = btc ? `$${Math.round(btc.price).toLocaleString('en-US')}` : 'N/A'
    const chg = btc ? `${btc.changePct.toFixed(2)}%` : 'N/A'
    const fng = input.fearGreed
    const net = input.network
    const stables = input.stablecoins.map((s) => `${s.symbol} $${s.marketCapB}B`).join(', ')
    const heads = input.headlines.slice(0, 4)

    const focusKo =
      input.category === 'ETF'
        ? `최근 헤드라인 흐름을 보면 ETF 관련 논의가 이어지고 있는 것으로 관측됩니다. 승인·자금 유입 관련 보도는 시장 구조에 영향을 줄 수 있는 요소로 평가됩니다.`
        : input.category === 'MACRO'
          ? `금리·물가·달러 흐름은 위험자산 선호도에 영향을 줄 수 있는 변수로 관측됩니다. 공포·탐욕 지수는 ${fng ? `${fng.value}(${fng.classification})` : '집계 불가'} 수준으로, 심리 지표상 신중한 접근이 시사됩니다.`
          : `활성 주소 약 ${net.activeAddresses?.toLocaleString('en-US') ?? 'N/A'}개, 일일 트랜잭션 약 ${net.transactions?.toLocaleString('en-US') ?? 'N/A'}건, 해시레이트 ${net.hashRateEh ?? 'N/A'} EH/s 수준으로 네트워크 활동이 유지되는 모습입니다. 스테이블코인 공급(${stables || 'N/A'})은 유동성 환경을 이해하는 참고 지표로 활용될 수 있습니다.`
    const focusEn =
      input.category === 'ETF'
        ? `Recent headlines suggest continued ETF-related developments; approval and flow coverage may act as structural factors worth monitoring.`
        : input.category === 'MACRO'
          ? `Rates, inflation and dollar dynamics could influence risk appetite. The Fear & Greed index reads ${fng ? `${fng.value} (${fng.classification})` : 'N/A'}, suggesting sentiment remains a variable to watch.`
          : `Active addresses near ${net.activeAddresses?.toLocaleString('en-US') ?? 'N/A'}, daily transactions around ${net.transactions?.toLocaleString('en-US') ?? 'N/A'} and hash rate at ${net.hashRateEh ?? 'N/A'} EH/s indicate sustained network activity. Stablecoin supply (${stables || 'N/A'}) may serve as a liquidity context indicator.`

    const headListKo = heads.map((h) => `- [${h.category}] ${h.title}`).join('\n')

    return {
      title: {
        ko: `${cadKo} ${catKo} 리포트 (${input.periodKey})`,
        en: `${cadEn} ${input.category} Report (${input.periodKey})`,
      },
      summary: {
        ko: `${input.periodKey} 기간의 ${catKo} 동향을 데이터 중심으로 정리했습니다. BTC는 ${price} 부근에서 ${chg}의 흐름을 보이고 있으며, 관련 지표들은 방향성 탐색 국면을 시사하는 것으로 보입니다.`,
        en: `A data-driven review of ${input.category} developments for ${input.periodKey}. BTC trades near ${price} (${chg} 24h), and related indicators appear to suggest a range-finding phase.`,
      },
      content: {
        ko: `## 개요\n${input.periodKey} 기간 동안 시장은 BTC ${price}(${chg}) 부근에서 등락을 이어갔습니다. 본 ${cadKo} 리포트는 ${catKo} 관점의 주요 관찰을 데이터 기준으로 정리합니다.\n\n## 주요 관찰\n${focusKo}\n\n## 데이터 하이라이트\n- BTC: ${price} (${chg}, 24시간)\n- 공포·탐욕 지수: ${fng ? `${fng.value} (${fng.classification})` : '집계 불가'}\n- 스테이블코인 시총: ${stables || 'N/A'}\n\n## 관련 헤드라인\n${headListKo || '- 해당 기간 수집된 헤드라인 없음'}\n\n## 지켜볼 요소\n규제·매크로 일정과 온체인 지표의 변화가 변동성 요인이 될 가능성이 있어 보입니다. 주요 가격대 부근의 거래량 변화는 시장 참여도를 이해하는 참고 지표로 관측됩니다.\n\n## 안내\n본 리포트는 정보 제공 목적의 비개인화 콘텐츠로, 투자 자문이나 매매 권유가 아닙니다.`,
        en: `## Overview\nDuring ${input.periodKey}, the market oscillated with BTC near ${price} (${chg}). This ${cadEn.toLowerCase()} report organizes key ${input.category} observations on a data basis.\n\n## Key observations\n${focusEn}\n\n## Data highlights\n- BTC: ${price} (${chg}, 24h)\n- Fear & Greed: ${fng ? `${fng.value} (${fng.classification})` : 'N/A'}\n- Stablecoin market caps: ${stables || 'N/A'}\n\n## What to watch\nRegulatory and macro calendars, together with shifts in on-chain indicators, could act as volatility factors. Volume behavior around key price areas may serve as a participation gauge.\n\n## Note\nThis report is non-personalized informational content — not investment advice or a solicitation to trade.`,
      },
    }
  }
}

// ---------------------------------------------------------------------------

let cached: AiProvider | null = null

export function getAiProvider(): AiProvider {
  if (cached) return cached
  const forced = process.env.AI_PROVIDER
  if (forced === 'mock') {
    cached = new MockProvider()
  } else if (process.env.ANTHROPIC_API_KEY) {
    cached = new AnthropicProvider(process.env.ANTHROPIC_API_KEY)
  } else {
    cached = new MockProvider()
  }
  return cached
}
