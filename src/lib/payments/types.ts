import type { BillingInterval, PaidPlanKey } from './plans'

export type { BillingInterval, PaidPlanKey }

// Provider-agnostic subscription status. Superset of the Prisma
// SubscriptionStatus enum so any provider maps cleanly onto it.
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete'

export interface SubscriptionData {
  /** Provider subscription id (e.g. Stripe sub_...). */
  id: string
  status: SubscriptionStatus
  /** Resolved from the subscription's price; null if the price is unknown. */
  plan: PaidPlanKey | null
  interval: BillingInterval | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  /** Provider customer id (e.g. Stripe cus_...). */
  customerId: string | null
}

export interface CreateCheckoutParams {
  plan: PaidPlanKey
  interval: BillingInterval
  /** Our internal user id, echoed back on the webhook to link the subscription. */
  userId: string
  email: string
  successUrl: string
  cancelUrl: string
  /** UI locale for the hosted checkout page. */
  locale: string
}

export interface CheckoutResult {
  id: string
  url: string
}

export interface CancelOptions {
  /** Cancel at the end of the paid period (default) vs immediately. */
  atPeriodEnd?: boolean
}

// Normalized webhook events. Providers collapse their own event zoo into these.
export type WebhookEvent =
  | { type: 'checkout.completed'; userId: string | null; subscription: SubscriptionData | null }
  | {
      type: 'subscription.created' | 'subscription.updated' | 'subscription.deleted'
      userId: string | null
      subscription: SubscriptionData
    }
  | { type: 'ignored'; raw: string }

export interface PaymentProvider {
  /** Create a hosted checkout session and return its redirect URL. */
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>
  /** Fetch current state of a subscription. */
  getSubscription(subscriptionId: string): Promise<SubscriptionData>
  /** Cancel a subscription (at period end by default). */
  cancelSubscription(subscriptionId: string, opts?: CancelOptions): Promise<SubscriptionData>
  /** Verify a webhook signature and normalize the event. */
  parseWebhook(rawBody: string, signature: string): Promise<WebhookEvent>
}
