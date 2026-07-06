import { z } from 'zod'

import { PATTERN_INTERVALS, PATTERN_SYMBOLS } from '@/lib/patterns/klines'

// ---------------------------------------------------------------------------
// Alert rule parameters — validated per AlertType. Alerts are strictly
// event notifications ("X happened"), never action directives.
// ---------------------------------------------------------------------------

export const priceParamsSchema = z.object({
  symbol: z
    .string()
    .regex(/^[A-Za-z0-9]{2,10}$/)
    .transform((s) => s.toUpperCase()),
  direction: z.enum(['above', 'below']),
  threshold: z.number().positive().finite(),
})

export const whaleParamsSchema = z.object({
  minUsd: z.number().min(100_000).finite(),
})

export const patternParamsSchema = z.object({
  symbol: z.enum(PATTERN_SYMBOLS),
  interval: z.enum(PATTERN_INTERVALS),
  minConfidence: z.number().min(0).max(100),
})

export const macroParamsSchema = z
  .object({
    low: z.number().min(0).max(100),
    high: z.number().min(0).max(100),
  })
  .refine((v) => v.low < v.high, { message: 'low must be below high' })

export const ruleParamsSchemaByType = {
  PRICE: priceParamsSchema,
  WHALE: whaleParamsSchema,
  PATTERN: patternParamsSchema,
  MACRO: macroParamsSchema,
} as const

export type PriceParams = z.infer<typeof priceParamsSchema>
export type WhaleParams = z.infer<typeof whaleParamsSchema>
export type PatternParams = z.infer<typeof patternParamsSchema>
export type MacroParams = z.infer<typeof macroParamsSchema>

// ---------------------------------------------------------------------------
// Channel configuration — one config row per (user, channel). INAPP needs
// no configuration (delivered to the in-app notification center).
// ---------------------------------------------------------------------------

export const telegramConfigSchema = z.object({
  chatId: z.string().regex(/^-?\d{4,20}$/),
})

export const emailConfigSchema = z.object({
  address: z.string().email().max(200),
})

export const pushConfigSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2000),
    keys: z.object({
      p256dh: z.string().min(10).max(500),
      auth: z.string().min(5).max(200),
    }),
  }),
})

export const channelConfigSchemaByChannel = {
  TELEGRAM: telegramConfigSchema,
  EMAIL: emailConfigSchema,
  PUSH: pushConfigSchema,
} as const

export type ConfigurableChannel = keyof typeof channelConfigSchemaByChannel

export type AlertMessage = {
  title: string
  body: string
}
