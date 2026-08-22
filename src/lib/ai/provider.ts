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

// Shared voice guidance injected into every generation prompt so live AI
// output reads like professional editorial writing — not machine translation
// or generic "AI assistant" prose — in whichever language it is rendered.
const VOICE_RULES = `Voice & language:
- Write like an experienced market analyst sending a morning note to colleagues: specific numbers first, short sentences, one idea per sentence. No hype, no padding, no throat-clearing.
- Open with what actually happened (price, % move, index reading, headline), then the context. Vary openings across sections; do not start every section with "<Asset> is trading near…" / "<자산>은 … 부근에서".
- Hedge where required, but hedge like a human: vary the wording and never stack two qualifiers in one sentence. Avoid stock phrases — English: "it is worth noting", "remains to be seen", "searching for direction", "a factor to watch", "in the coming days"; Korean: "방향성 탐색", "관전 포인트", "신중한 접근이 필요", "유의할 필요가 있어 보입니다", and "~하는 모습입니다" more than once per section.
- Produce the Korean and English versions independently. Each must read as if originally written by a native professional, never as a translation of the other — do not mirror the other language's sentence order or structure.
- Korean: 신문 시황 기사의 문어체 합니다체 — 간결한 존댓말 평서문. No translationese: no unnecessary passives ("~되어지고"), no "~에 대하여 / ~을 위한" padding, no literal pronouns ("그것은", "이것들"), no English word order. Do not end consecutive sentences with the same ending (e.g. "~할 수 있습니다" twice in a row).
- English: plain, confident financial-news prose. Concrete nouns and verbs, no inflated adjectives, no em-dash chains, no "leverage / seamless / unlock / elevate".
- Cut AI/assistant tells entirely: no meta-commentary or self-reference, no empty openers ("In today's market", "주목할 만한 점은"), no rote transitions ("Overall", "In conclusion", "결론적으로", "요약하자면"), no list-like enumerations inside prose.
- If a data point is missing or marked unavailable, say so in a short natural clause or leave it out — never print placeholders such as "N/A" or "집계 불가" inside prose.`

const SYSTEM_PROMPT = `You analyze crypto news headlines for an informational platform (not an advisory service).

Rules:
- Ground everything strictly in the given headline. Do not invent facts, numbers, price targets, or events.
- Never give investment advice, buy/sell recommendations, or profit promises. Neutral, factual tone.
- summary_ko: 1-2 sentences in Korean (roughly 60-200 characters) restating and lightly contextualizing the headline.
- summary_en: the same in English (roughly 60-250 characters).
- Lead with the fact, not the source: do not open every summary with "According to <source>" / "<source>에 따르면"; name the source only when attribution matters. Write it like a wire-service one-liner — who did what, plus the one clause of context that makes it matter.
- sentiment: the TONE of the news itself — "bullish", "neutral", or "bearish".
- confidence: 0-100, how clearly that tone reads from the headline (ambiguous → low).

${VOICE_RULES}`

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
Network: active addresses ${input.network.activeAddresses ?? 'unavailable'}, daily txs ${input.network.transactions ?? 'unavailable'}, hash rate ${input.network.hashRateEh ?? 'unavailable'} EH/s, miner revenue ${input.network.minerRevenueUsd ?? 'unavailable'}
Stablecoins: ${input.stablecoins.map((s) => `${s.symbol} ${s.marketCapB}B`).join(', ') || 'unavailable'}
(Where a value is unavailable, leave it out of the prose — never write "N/A".)
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

Structure the markdown content with ## headings: 개요/Overview, 주요 관찰/Key observations, 데이터 하이라이트/Data highlights, 지켜볼 요소/What to watch, and a one-line closing note that the report is informational. Write it like a research-desk note, not a filled-in template: every section must say something specific to this period's numbers and headlines, and if the data says nothing about a point, leave the point out rather than pad it. Headings are the only boilerplate allowed.

${VOICE_RULES}`

const PORTFOLIO_SYSTEM_PROMPT = `You explain portfolio diversification metrics for an educational, informational platform.

Hard rules (principle A-2-7):
- EXPLAIN the metrics only — what HHI, effective asset count, and concentration mean, and what the given values indicate descriptively.
- NEVER give advice or directives: no "rebalance", no "you should", no "we recommend", no "consider buying/selling/reducing", no suggestions to change the portfolio in any way.
- Do not predict prices or outcomes. Neutral, educational tone.
- The input contains percentages and index values only — do not invent amounts, currencies, or personal details.
- ko: 3-5 Korean sentences. en: 3-5 English sentences. Write like a patient educator walking a colleague through a chart: lead with the reader's own numbers, then what each metric means in plain words, one concept per sentence. No lecture tone, no bullet dump, no hedging tics such as "descriptively" or "지표상".

${VOICE_RULES}`

const BRIEF_SYSTEM_PROMPT = `You write a daily crypto market brief for an informational platform (not an advisory service). It is published identically to all subscribers — never personalized.

Hard rules:
- Ground every statement in the provided market data and headlines only. No invented facts, numbers, or events.
- NO definitive predictions. Never state that a price WILL rise/fall/reach a level. Use probabilistic, hedged language in every section (Korean: "~할 가능성", "~수 있습니다", "~로 보입니다", "전망입니다"; English: "may", "could", "appears", "suggests", "likely").
- NO action directives. Never tell readers to buy, sell, enter, exit, or recommend any position.
- NO profit guarantees or risk-free claims.
- Neutral, analytical, factual tone. Information and education purpose only.

Sections (the page labels each section, so never put a heading or prefix such as "Today's market brief:" inside the text):
- btc: Bitcoin — the 24h move and price first, then the one thing that explains or qualifies it
- eth: Ethereum — the move, then its read relative to bitcoin and ecosystem context
- altcoin: altcoin/market-breadth observations (SOL and others from the data); say where names diverge from bitcoin
- macro: traditional markets / macro backdrop (indices, dollar, commodities) and the Fear & Greed reading, as they bear on crypto
- today: the takeaway a reader could repeat — what changed, what the data says, what is on the calendar (levels framed as observations, not targets)
- The first sentence of btc and of today is reused verbatim as a social-post teaser: make each a standalone sentence with the number in it, under roughly 120 characters (Korean: 60자 안팎).

${VOICE_RULES}`

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
    // Second sentence follows the (mock) sentiment so the digest reads coherently.
    const tailKo: Record<(typeof sentiments)[number], string> = {
      bullish: '시장에는 우호적인 재료로 읽힐 수 있는 내용입니다.',
      neutral: '단기 시장 영향은 제한적일 것으로 보입니다.',
      bearish: '단기 투자심리에는 부담이 될 수 있는 소식입니다.',
    }
    const tailEn: Record<(typeof sentiments)[number], string> = {
      bullish: 'The tone is constructive for sentiment.',
      neutral: 'Market impact looks limited for now.',
      bearish: 'The news could weigh on near-term sentiment.',
    }

    return {
      summary_ko: `${input.source}에서 "${short}" 소식을 전했습니다. ${tailKo[sentiment]}`,
      summary_en: `${input.source} reports "${short}". ${tailEn[sentiment]}`,
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
    const detailed = input.tier === 'detailed'
    const n = input.headlines.length

    type Quote = { price: number; changePct: number }
    type Move = 'up' | 'down' | 'flat'
    const usd = (q: Quote) => `${Math.round(q.price).toLocaleString('en-US')}`
    const abs = (p: number) => Math.abs(p).toFixed(2)
    const signed = (p: number) => `${p > 0 ? '+' : ''}${p.toFixed(2)}%`
    const trend = (q: Quote): Move => (q.changePct >= 0.5 ? 'up' : q.changePct <= -0.5 ? 'down' : 'flat')
    // "24시간 전보다 1.85% 오른 $65,200" · "$64,000 안팎(24시간 +0.12%)"
    const moveKo = (q: Quote) => {
      const t = trend(q)
      if (t === 'up') return `24시간 전보다 ${abs(q.changePct)}% 오른 ${usd(q)}`
      if (t === 'down') return `24시간 전보다 ${abs(q.changePct)}% 내린 ${usd(q)}`
      return `${usd(q)} 안팎(24시간 ${signed(q.changePct)})`
    }
    // "$65,200, up 1.85% over the past 24 hours" · "$64,000, little changed (+0.12%) over the past 24 hours"
    const moveEn = (q: Quote) => {
      const t = trend(q)
      if (t === 'up') return `${usd(q)}, up ${abs(q.changePct)}% over the past 24 hours`
      if (t === 'down') return `${usd(q)}, down ${abs(q.changePct)}% over the past 24 hours`
      return `${usd(q)}, little changed (${signed(q.changePct)}) over the past 24 hours`
    }

    // Bitcoin's move sets the tone for the btc and today sections.
    const t: Move = btc ? trend(btc) : 'flat'
    const btcPct = btc ? abs(btc.changePct) : ''
    const btcTailKo: Record<Move, string> = {
      up: '상승분을 지켜내는지가 관건으로, 거래량이 따라붙지 않으면 되돌림이 나올 수 있습니다.',
      down: '낙폭이 크지 않아 추세가 꺾였다고 보기는 이르지만, 거래량이 늘면 변동폭이 더 커질 수 있습니다.',
      flat: '하루 변동폭이 1%에 못 미치는 만큼, 새 재료가 나오기 전까지는 좁은 박스권 등락이 이어질 수 있습니다.',
    }
    const btcTailEn: Record<Move, string> = {
      up: 'Whether it holds the gain is the question; without volume behind the move, some of it could be given back.',
      down: 'The drop is modest and does not by itself suggest a change in trend, but a pickup in volume could widen the range.',
      flat: 'With the 24-hour range under 1%, the market looks likely to drift until a new catalyst appears.',
    }
    // First sentence of `today` doubles as the social teaser — standalone, numbers in.
    const leadKo: Record<Move, string> = {
      up: `오늘의 관건은 비트코인이 ${btcPct}% 상승분을 지키느냐입니다.`,
      down: `오늘의 관건은 비트코인이 ${btcPct}% 하락 뒤 낙폭을 만회하느냐입니다.`,
      flat: '오늘의 관건은 좁은 박스권에 머문 비트코인이 어느 쪽으로 빠져나오느냐입니다.',
    }
    const leadEn: Record<Move, string> = {
      up: `The question today is whether bitcoin holds its ${btcPct}% gain.`,
      down: `The question today is whether bitcoin recovers the ${btcPct}% it gave up.`,
      flat: 'The question today is which way bitcoin leaves a range of under 1%.',
    }
    const headsKo =
      n === 0
        ? '지난 24시간 동안 새로 들어온 헤드라인은 없어, 오늘은 시세 자체가 재료입니다.'
        : `지난 24시간 동안 헤드라인 ${n}건이 들어왔고, 규제·매크로 관련 소식이 섞여 있다면 변동성이 커질 수 있습니다.`
    const headsEn =
      n === 0
        ? 'No new headlines came in over the past 24 hours, so price itself is the story today.'
        : `${n} headlines came in over the past 24 hours; any regulatory or macro news among them could add to volatility.`
    const closeKo = btc
      ? '가격이 최근 거래 범위를 벗어나는지, 그때 거래량이 붙는지를 보면 시장 참여도를 가늠할 수 있습니다.'
      : '시세가 복구되면 브리핑을 갱신하며, 그때까지는 헤드라인이 단기 흐름을 좌우할 가능성이 있습니다.'
    const closeEn = btc
      ? 'Whether price leaves its recent range, and whether volume comes with it, is likely the best read on participation.'
      : 'The brief updates once the feed is back; until then headlines are likely to drive the short-term tape.'

    const extraKo = detailed
      ? ' 파생상품 포지션과 온체인 자금 흐름은 단기 변동성이 커질 수 있음을 시사합니다. 주요 가격대에서 거래량이 붙는지가 다음 단서입니다.'
      : ''
    const extraEn = detailed
      ? ' Derivatives positioning and on-chain flows point to the possibility of a wider short-term range; volume at the key levels is the next tell.'
      : ''

    const sections: BriefSectionsOutput = {
      btc: {
        ko: `${
          btc
            ? `비트코인은 ${moveKo(btc)}에 거래되고 있습니다. ${btcTailKo[t]}`
            : '비트코인 시세는 현재 집계되지 않아 가격 언급은 생략합니다. 시세가 복구되는 대로 다음 브리핑에 반영되며, 그사이 헤드라인 흐름이 단기 변동성을 키울 수 있습니다.'
        }${extraKo}`,
        en: `${
          btc
            ? `Bitcoin is trading at ${moveEn(btc)}. ${btcTailEn[t]}`
            : "Bitcoin's price feed is unavailable right now, so this brief leaves the number out rather than guess. Headlines may still move the market in the meantime; the next brief picks up once the feed is back."
        }${extraEn}`,
      },
      eth: {
        ko: `${
          eth
            ? `이더리움은 ${moveKo(eth)}입니다. 비트코인 대비 상대 강도가 유지되는지가 관건이며, 네트워크 활동이 뒷받침되면 수요가 이어질 가능성이 있습니다.`
            : '이더리움 시세는 현재 집계되지 않았습니다. 비트코인 대비 상대 강도는 시세가 복구되는 대로 다시 점검할 예정이며, 그 전까지는 비트코인 흐름에 연동될 가능성이 큽니다.'
        }${extraKo}`,
        en: `${
          eth
            ? `Ethereum is at ${moveEn(eth)}. The key read is its strength relative to bitcoin; with network activity holding up, demand could persist.`
            : "Ethereum's price feed is unavailable at the moment. Until it returns, ETH is likely to move with bitcoin rather than on its own story."
        }${extraEn}`,
      },
      altcoin: {
        ko: `${
          sol
            ? `솔라나(${usd(sol)}, 24시간 ${signed(sol.changePct)})를 비롯한 주요 알트코인은 대체로 비트코인을 따라 움직이고 있습니다. 다만 종목별 온도 차가 커서, 당분간은 개별 재료가 등락을 가르는 장세가 이어질 수 있습니다.`
            : '주요 알트코인 시세는 현재 일부만 집계되어 종목별 언급은 생략합니다. 알트코인은 통상 비트코인 변동에 더 크게 반응하는 만큼, 비트코인이 흔들리면 변동폭이 더 커질 수 있습니다.'
        }${extraKo}`,
        en: `${
          sol
            ? `Solana (${usd(sol)}, ${signed(sol.changePct)} on the day) and the other large alts are mostly following bitcoin. Dispersion between names is wide, though, so individual catalysts may matter more than the index for now.`
            : "Altcoin prices are only partly available right now, so this brief skips individual names. As a rule alts amplify bitcoin's moves, so any swing in BTC could show up larger here."
        }${extraEn}`,
      },
      macro: {
        ko: `${fng ? `공포·탐욕 지수는 ${fng.value}(${fng.classification})입니다.` : '공포·탐욕 지수는 현재 집계되지 않았습니다.'} 금리와 달러, 증시 흐름이 위험자산 선호를 좌우하는 환경이라, 주요 매크로 일정 전후로 변동성이 커질 가능성이 있습니다.${extraKo}`,
        en: `${fng ? `The Fear & Greed index sits at ${fng.value} (${fng.classification}).` : 'The Fear & Greed index is not available today.'} Rates, the dollar and equities are still setting the tone for risk appetite, so volatility could pick up around the macro calendar.${extraEn}`,
      },
      today: {
        ko: `${btc ? leadKo[t] : '오늘은 비트코인 시세가 집계되지 않아 가격 기준 판단은 보류합니다.'} ${headsKo} ${closeKo}${extraKo}`,
        en: `${btc ? leadEn[t] : "Bitcoin's price is unavailable today, so this brief holds off on any price-based read."} ${headsEn} ${closeEn}${extraEn}`,
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
      ko: `이 포트폴리오의 허핀달 지수(HHI)는 ${input.hhi.toFixed(3)}으로, 분류 기준으로는 '${labelKo}' 구간에 들어갑니다. HHI는 각 자산 비중을 제곱해 더한 값이라, 숫자가 클수록 소수 자산에 쏠려 있다는 뜻입니다. 같은 비중으로 나눠 담았다고 가정하면 약 ${input.effectiveAssets.toFixed(1)}개 자산에 해당하는 분산 수준이고, 가장 큰 비중은 ${input.topSymbol}(${input.topWeightPct.toFixed(1)}%)입니다. 두 숫자를 함께 보면 지금 배분이 얼마나 한쪽으로 기울어 있는지 가늠할 수 있습니다.`,
      en: `This portfolio's Herfindahl index (HHI) is ${input.hhi.toFixed(3)}, which puts it in the "${input.concentration}" band. HHI adds up the squares of each asset's weight, so the higher it is, the more the allocation leans on a few names. Read another way, the mix is about as diversified as ${input.effectiveAssets.toFixed(1)} equally weighted assets, and the largest single weight is ${input.topSymbol} at ${input.topWeightPct.toFixed(1)}%. Together those two numbers show how concentrated or spread out the allocation is right now.`,
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
    const catEn = { ETF: 'ETF', MACRO: 'macro', ONCHAIN: 'on-chain' }[input.category]
    const catTitleEn = { ETF: 'ETF', MACRO: 'Macro', ONCHAIN: 'On-chain' }[input.category]
    const cadKo = { WEEKLY: '주간', MONTHLY: '월간', QUARTERLY: '분기' }[input.cadence]
    const cadEn = { WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly' }[input.cadence]
    const btc = input.market.find((m) => m.id === 'BTC')
    const price = btc ? `${Math.round(btc.price).toLocaleString('en-US')}` : ''
    const chg = btc ? `${btc.changePct > 0 ? '+' : ''}${btc.changePct.toFixed(2)}%` : ''
    const fng = input.fearGreed
    const net = input.network
    const num = (v: number) => v.toLocaleString('en-US')
    const stables = input.stablecoins.map((s) => `${s.symbol} ${s.marketCapB}B`).join(', ')
    const headList = input.headlines
      .slice(0, 4)
      .map((h) => `- [${h.category}] ${h.title}`)
      .join('\n')
    const etfHeads = input.headlines.filter((h) => /\bETF/i.test(h.title)).length

    // Missing inputs get a plain sentence, never a placeholder in prose.
    const btcLineKo = btc
      ? `비트코인은 ${price}(24시간 ${chg})에 거래되고 있습니다.`
      : '비트코인 시세는 집계 시점에 확보되지 않아 이번 호에서는 가격 언급을 생략합니다.'
    const btcLineEn = btc
      ? `Bitcoin is at ${price} (${chg} over 24h).`
      : "Bitcoin's price was not available when this issue was compiled, so the number is left out."
    const fngKo = fng
      ? `공포·탐욕 지수는 ${fng.value}(${fng.classification})입니다.`
      : '공포·탐욕 지수는 이번 집계에서 확보되지 않았습니다.'
    const fngEn = fng
      ? `The Fear & Greed index is at ${fng.value} (${fng.classification}).`
      : 'The Fear & Greed index was not available this period.'
    const netKo = [
      net.activeAddresses !== null ? `활성 주소 약 ${num(net.activeAddresses)}개` : '',
      net.transactions !== null ? `일일 트랜잭션 약 ${num(net.transactions)}건` : '',
      net.hashRateEh !== null ? `해시레이트 ${net.hashRateEh} EH/s` : '',
    ].filter(Boolean)
    const netEn = [
      net.activeAddresses !== null ? `active addresses near ${num(net.activeAddresses)}` : '',
      net.transactions !== null ? `daily transactions around ${num(net.transactions)}` : '',
      net.hashRateEh !== null ? `hash rate at ${net.hashRateEh} EH/s` : '',
    ].filter(Boolean)

    const focusKo =
      input.category === 'ETF'
        ? `${etfHeads > 0 ? `이 기간 헤드라인 가운데 ETF 관련 보도는 ${etfHeads}건입니다.` : '이 기간에는 ETF 관련 헤드라인이 따로 잡히지 않았습니다.'} 승인과 자금 유출입 소식은 현물 수급에 직접 닿는 재료라, 새 보도가 나오면 시장 구조에 영향을 줄 수 있습니다.`
        : input.category === 'MACRO'
          ? `${fngKo} 금리와 물가, 달러 방향이 위험자산 선호를 좌우하는 국면이라, 주요 매크로 일정 전후로 암호화폐 변동성도 함께 커질 가능성이 있습니다.`
          : `${netKo.length ? `네트워크 지표는 ${netKo.join(', ')} 수준으로, 활동이 꺾였다고 볼 만한 신호는 없어 보입니다.` : '네트워크 지표는 이번 집계에서 확보되지 않았습니다.'} ${stables ? `스테이블코인 시가총액(${stables})은 거래소 유동성의 가늠자로, 증감 방향이 위험 선호를 읽는 참고가 될 수 있습니다.` : '스테이블코인 시가총액은 이번 집계에서 확보되지 않았습니다.'}`
    const focusEn =
      input.category === 'ETF'
        ? `${etfHeads === 0 ? 'No ETF-specific headlines were picked up this period.' : etfHeads === 1 ? 'One headline this period touches on ETFs.' : `${etfHeads} of this period's headlines touch on ETFs.`} Approval and flow news feeds straight into spot demand, so fresh coverage could shape market structure well beyond the day's move.`
        : input.category === 'MACRO'
          ? `${fngEn} Rates, inflation and the dollar are still setting risk appetite, so crypto volatility could rise around the major macro dates.`
          : `${netEn.length ? `Network metrics: ${netEn.join(', ')}. Nothing in those numbers suggests activity is rolling over.` : 'Network metrics were not available for this period.'} ${stables ? `Stablecoin market caps (${stables}) are a useful proxy for exchange liquidity; the direction of change tends to indicate how much risk appetite is in the system.` : 'Stablecoin market caps were not available for this period.'}`

    return {
      title: {
        ko: `${cadKo} ${catKo} 리포트 (${input.periodKey})`,
        en: `${cadEn} ${catTitleEn} Report (${input.periodKey})`,
      },
      summary: {
        ko: `${input.periodKey} ${catKo} 동향입니다. ${btcLineKo} 이 기간의 핵심 수치와 헤드라인을 ${catKo} 관점에서 정리했으며, 수치만 보면 뚜렷한 추세보다는 범위 내 등락에 가까워 보입니다.`,
        en: `${cadEn} ${catEn} review for ${input.periodKey}. ${btcLineEn} The ${catEn} numbers and headlines for the period are below; on the data alone it reads more like a range than a trend, though one catalyst could change that.`,
      },
      content: {
        ko: `## 개요\n${btcLineKo} 이번 ${cadKo} 리포트는 ${input.periodKey} 기간의 ${catKo} 관련 수치와 헤드라인을 모아 정리한 것입니다.\n\n## 주요 관찰\n${focusKo}\n\n## 데이터 하이라이트\n- 비트코인: ${btc ? `${price} (24시간 ${chg})` : '집계되지 않음'}\n- 공포·탐욕 지수: ${fng ? `${fng.value} (${fng.classification})` : '집계되지 않음'}\n- 스테이블코인 시가총액: ${stables || '집계되지 않음'}\n\n## 관련 헤드라인\n${headList || '- 이 기간에 수집된 헤드라인이 없습니다.'}\n\n## 지켜볼 요소\n규제·매크로 일정과 온체인 지표의 변화가 변동성을 키울 수 있는 요인입니다. 주요 가격대에서 거래량이 어떻게 바뀌는지를 보면 시장 참여도를 가늠할 수 있습니다.\n\n## 안내\n본 리포트는 정보 제공 목적의 비개인화 콘텐츠로, 투자 자문이나 매매 권유가 아닙니다.`,
        en: `## Overview\n${btcLineEn} This ${cadEn.toLowerCase()} note covers the ${catEn} data and headlines for ${input.periodKey}.\n\n## Key observations\n${focusEn}\n\n## Data highlights\n- Bitcoin: ${btc ? `${price} (${chg}, 24h)` : 'not available'}\n- Fear & Greed: ${fng ? `${fng.value} (${fng.classification})` : 'not available'}\n- Stablecoin market caps: ${stables || 'not available'}\n\n## Headlines\n${headList || '- No headlines were collected for this period.'}\n\n## What to watch\nRegulatory and macro dates, plus any shift in on-chain metrics, could add volatility. How volume behaves at the main price levels is the clearest read on participation.\n\n## Note\nThis report is non-personalized informational content, not investment advice or a solicitation to trade.`,
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
