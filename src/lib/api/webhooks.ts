import 'server-only'

import crypto from 'node:crypto'

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Outbound webhooks. Each delivery is signed with the webhook's secret:
//   x-cryptoguide-signature: sha256=<hmac-sha256(secret, rawBody)>
// Failures never propagate to the caller (fire-and-forget with timeout).
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENTS = ['brief.published', 'report.published', 'test.ping'] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export function signWebhookPayload(secret: string, rawBody: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
}

export type DeliveryResult = { delivered: boolean; status: number | null; error?: string }

export async function deliverWebhook(
  webhook: { id: string; url: string; secret: string },
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<DeliveryResult> {
  const body = JSON.stringify({ event, data, sentAt: new Date().toISOString() })
  let result: DeliveryResult
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cryptoguide-event': event,
        'x-cryptoguide-signature': signWebhookPayload(webhook.secret, body),
      },
      body,
      signal: AbortSignal.timeout(5_000),
    })
    result = { delivered: res.ok, status: res.status }
  } catch (err) {
    result = { delivered: false, status: null, error: String(err) }
  }

  await prisma.apiWebhook
    .update({
      where: { id: webhook.id },
      data: { lastDeliveryAt: new Date(), lastStatus: result.status ?? 0 },
    })
    .catch(() => {})
  return result
}

/** Broadcast an event to every active webhook subscribed to it. */
export async function dispatchWebhooks(
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const hooks = await prisma.apiWebhook
    .findMany({ where: { active: true, events: { has: event } } })
    .catch(() => [])
  if (hooks.length === 0) return
  await Promise.allSettled(hooks.map((hook) => deliverWebhook(hook, event, data)))
}
