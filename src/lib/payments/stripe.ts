import Stripe from 'stripe'

import { paidPlans, priceEnvVar, type BillingInterval, type PaidPlanKey } from './plans'
import type {
  CancelOptions,
  CheckoutResult,
  CreateCheckoutParams,
  PaymentProvider,
  SubscriptionData,
  SubscriptionStatus,
  WebhookEvent,
} from './types'

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'incomplete_expired':
      return 'expired'
    case 'incomplete':
    case 'paused':
    default:
      return 'incomplete'
  }
}

// `current_period_end` lives on the subscription in older API versions and on
// the subscription item in newer ones — read whichever is present.
function periodEndOf(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  const subLevel = (sub as unknown as { current_period_end?: number }).current_period_end
  const unix = item?.current_period_end ?? subLevel
  return unix ? new Date(unix * 1000) : null
}

export class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: Stripe
  private readonly webhookSecret: string
  // plan/interval → price id, and the reverse for webhook resolution.
  private readonly priceId: Record<PaidPlanKey, Record<BillingInterval, string | undefined>>
  private readonly planByPrice = new Map<string, { plan: PaidPlanKey; interval: BillingInterval }>()

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    this.stripe = new Stripe(key)
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

    this.priceId = {} as Record<PaidPlanKey, Record<BillingInterval, string | undefined>>
    for (const plan of paidPlans) {
      this.priceId[plan] = { monthly: undefined, yearly: undefined }
      for (const interval of ['monthly', 'yearly'] as BillingInterval[]) {
        const id = process.env[priceEnvVar[plan][interval]]
        this.priceId[plan][interval] = id
        if (id) this.planByPrice.set(id, { plan, interval })
      }
    }
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const price = this.priceId[params.plan]?.[params.interval]
    if (!price) {
      throw new Error(
        `No Stripe price configured for ${params.plan}/${params.interval}. Run \`npm run stripe:seed\`.`,
      )
    }

    const metadata = { userId: params.userId, plan: params.plan, interval: params.interval }
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      customer_email: params.email,
      client_reference_id: params.userId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      locale: params.locale === 'ko' ? 'ko' : 'en',
      allow_promotion_codes: true,
      metadata,
      subscription_data: { metadata },
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return { id: session.id, url: session.url }
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionData> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId)
    return this.toSubscriptionData(sub)
  }

  async cancelSubscription(
    subscriptionId: string,
    opts: CancelOptions = {},
  ): Promise<SubscriptionData> {
    const atPeriodEnd = opts.atPeriodEnd ?? true
    const sub = atPeriodEnd
      ? await this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
      : await this.stripe.subscriptions.cancel(subscriptionId)
    return this.toSubscriptionData(sub)
  }

  async parseWebhook(rawBody: string, signature: string): Promise<WebhookEvent> {
    if (!this.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id ?? session.metadata?.userId ?? null
        const subscription =
          typeof session.subscription === 'string'
            ? await this.getSubscription(session.subscription)
            : null
        return { type: 'checkout.completed', userId, subscription }
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const typeMap = {
          'customer.subscription.created': 'subscription.created',
          'customer.subscription.updated': 'subscription.updated',
          'customer.subscription.deleted': 'subscription.deleted',
        } as const
        return {
          type: typeMap[event.type],
          userId: sub.metadata?.userId ?? null,
          subscription: this.toSubscriptionData(sub),
        }
      }
      default:
        return { type: 'ignored', raw: event.type }
    }
  }

  private toSubscriptionData(sub: Stripe.Subscription): SubscriptionData {
    const priceId = sub.items.data[0]?.price.id ?? null
    const mapped = priceId ? this.planByPrice.get(priceId) : undefined
    return {
      id: sub.id,
      status: mapStatus(sub.status),
      plan: mapped?.plan ?? null,
      interval: mapped?.interval ?? null,
      currentPeriodEnd: periodEndOf(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      customerId: typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null),
    }
  }
}
