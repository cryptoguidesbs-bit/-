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
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  /** End of the free trial, when the subscription is trialing. */
  trialEnd: Date | null
  /** Provider customer id (e.g. Stripe cus_...). */
  customerId: string | null
  /** Provider subscription-item id — needed to change the price in place. */
  itemId: string | null
  /** Id of the most recent paid invoice (for refunds). */
  latestInvoiceId: string | null
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
  /** Free-trial length in days (no charge until it ends). */
  trialPeriodDays?: number
}

export interface SwitchPriceParams {
  subscriptionId: string
  itemId: string
  newPriceId: string
  /**
   * true  → invoice the prorated difference immediately (upgrades).
   * false → no proration (applying a deferred downgrade at renewal).
   */
  prorate: boolean
}

export interface RefundResult {
  refundId: string
  amount: number
  currency: string
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
  | {
      // Renewal is coming up — used to send the 3-day-before reminder.
      type: 'invoice.upcoming'
      customerId: string | null
      amountDue: number
      currency: string
      renewalAt: Date | null
    }
  | { type: 'ignored'; raw: string }

export interface PaymentProvider {
  /** Create a hosted checkout session and return its redirect URL. */
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>
  /** Fetch current state of a subscription. */
  getSubscription(subscriptionId: string): Promise<SubscriptionData>
  /** Cancel a subscription (at period end by default). */
  cancelSubscription(subscriptionId: string, opts?: CancelOptions): Promise<SubscriptionData>
  /** Switch the subscription's price (proration decided by the caller). */
  switchPrice(params: SwitchPriceParams): Promise<SubscriptionData>
  /** Refund the latest invoice and cancel immediately (annual refund window). */
  refundSubscription(subscriptionId: string): Promise<RefundResult>
  /** Verify a webhook signature and normalize the event. */
  parseWebhook(rawBody: string, signature: string): Promise<WebhookEvent>
  /**
   * Optional: resolve a completed checkout back to its user + subscription.
   * Used to reconcile right after the success redirect, without waiting for
   * the webhook.
   */
  getCheckoutSession?(
    sessionId: string,
  ): Promise<{ userId: string | null; subscription: SubscriptionData | null }>
}
