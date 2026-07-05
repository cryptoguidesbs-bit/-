import { StripePaymentProvider } from './stripe'
import type { PaymentProvider } from './types'

let cached: PaymentProvider | null = null

// Returns the configured payment provider. Swap providers via PAYMENT_PROVIDER
// (only "stripe" is implemented today). Lazily constructed so importing this
// module never requires payment env vars until a payment actually happens.
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached

  const which = process.env.PAYMENT_PROVIDER ?? 'stripe'
  switch (which) {
    case 'stripe':
      cached = new StripePaymentProvider()
      break
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${which}`)
  }
  return cached
}

export * from './types'
export { paidPlans, planAmounts, planLabels, priceEnvVar, isPaidPlan } from './plans'
