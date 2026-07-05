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

export interface AiProvider {
  /** Model label persisted with each result (AI-generated content label). */
  readonly model: string
  analyzeArticle(input: AnalyzeInput): Promise<ArticleAnalysis>
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
}

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
