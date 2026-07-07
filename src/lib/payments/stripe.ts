import Stripe from 'stripe'

import { paidPlans, priceEnvVar, type BillingInterval, type PaidPlanKey } from './plans'
import type {
  CancelOptions,
  CheckoutResult,
  CreateCheckoutParams,
  PaymentProvider,
  RefundResult,
  SubscriptionData,
  SubscriptionStatus,
  SwitchPriceParams,
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

function periodStartOf(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0] as unknown as { current_period_start?: number } | undefined
  const subLevel = (sub as unknown as { current_period_start?: number }).current_period_start
  const unix = item?.current_period_start ?? subLevel ?? sub.start_date
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
      subscription_data: {
        metadata,
        // 7-day free trial: nothing is charged until it ends; cancelling
        // during the trial results in no charge at all.
        ...(params.trialPeriodDays ? { trial_period_days: params.trialPeriodDays } : {}),
      },
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return { id: session.id, url: session.url }
  }

  async switchPrice(params: SwitchPriceParams): Promise<SubscriptionData> {
    // Upgrades invoice the prorated difference now; a deferred downgrade
    // (applied at renewal) switches with no proration.
    const sub = await this.stripe.subscriptions.update(params.subscriptionId, {
      items: [{ id: params.itemId, price: params.newPriceId }],
      proration_behavior: params.prorate ? 'always_invoice' : 'none',
    })
    return this.toSubscriptionData(sub)
  }

  async refundSubscription(subscriptionId: string): Promise<RefundResult> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId)
    const invoiceId =
      typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id
    if (!invoiceId) throw new Error('no invoice to refund')

    // Resolve the charge/payment-intent across Stripe API versions.
    const invoice = (await this.stripe.invoices.retrieve(invoiceId, {
      expand: ['payment_intent', 'charge'],
    })) as unknown as {
      payment_intent?: Stripe.PaymentIntent | string | null
      charge?: Stripe.Charge | string | null
    }
    const piId =
      typeof invoice.payment_intent === 'string'
        ? invoice.payment_intent
        : invoice.payment_intent?.id
    const chargeId = typeof invoice.charge === 'string' ? invoice.charge : invoice.charge?.id

    let refund: Stripe.Refund
    if (piId) {
      refund = await this.stripe.refunds.create({ payment_intent: piId })
    } else if (chargeId) {
      refund = await this.stripe.refunds.create({ charge: chargeId })
    } else {
      // Fallback: refund the latest paid charge on the customer.
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null)
      const charges = customerId
        ? await this.stripe.charges.list({ customer: customerId, limit: 1 })
        : { data: [] as Stripe.Charge[] }
      const latest = charges.data.find((c) => c.paid && !c.refunded)
      if (!latest) throw new Error('no charge to refund')
      refund = await this.stripe.refunds.create({ charge: latest.id })
    }

    // Full refund → cancel the subscription immediately.
    await this.stripe.subscriptions.cancel(subscriptionId).catch(() => {})
    return {
      refundId: refund.id,
      amount: (refund.amount ?? 0) / 100,
      currency: refund.currency ?? 'usd',
    }
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

  async getCheckoutSession(
    sessionId: string,
  ): Promise<{ userId: string | null; subscription: SubscriptionData | null }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId)
    const userId = session.client_reference_id ?? session.metadata?.userId ?? null
    const subscription =
      typeof session.subscription === 'string'
        ? await this.getSubscription(session.subscription)
        : null
    return { userId, subscription }
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
      case 'invoice.upcoming': {
        const invoice = event.data.object as Stripe.Invoice
        const renewalUnix = (invoice as unknown as { next_payment_attempt?: number; period_end?: number })
          .next_payment_attempt ?? invoice.period_end
        return {
          type: 'invoice.upcoming',
          customerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null),
          amountDue: (invoice.amount_due ?? 0) / 100,
          currency: invoice.currency ?? 'usd',
          renewalAt: renewalUnix ? new Date(renewalUnix * 1000) : null,
        }
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
    const item = sub.items.data[0]
    const priceId = item?.price.id ?? null
    const mapped = priceId ? this.planByPrice.get(priceId) : undefined
    const latestInvoice = sub.latest_invoice
    return {
      id: sub.id,
      status: mapStatus(sub.status),
      plan: mapped?.plan ?? null,
      interval: mapped?.interval ?? null,
      currentPeriodStart: periodStartOf(sub),
      currentPeriodEnd: periodEndOf(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      customerId: typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null),
      itemId: item?.id ?? null,
      latestInvoiceId:
        typeof latestInvoice === 'string' ? latestInvoice : (latestInvoice?.id ?? null),
    }
  }
}
