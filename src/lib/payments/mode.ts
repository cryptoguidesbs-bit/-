// Free-first launch switch. Payments cannot go live before the LLC exists
// (Stripe live activation needs a legal entity), so checkout is only enabled
// when NEXT_PUBLIC_PAYMENTS_MODE is EXPLICITLY "live" — a missing or mistyped
// value fails closed to waitlist mode (paid CTAs collect emails, the checkout
// API refuses to create sessions). Local dev sets live in .env.local.
export type PaymentsMode = 'live' | 'waitlist'

export function paymentsMode(): PaymentsMode {
  const raw = (process.env.NEXT_PUBLIC_PAYMENTS_MODE ?? '').trim().toLowerCase()
  return raw === 'live' ? 'live' : 'waitlist'
}
