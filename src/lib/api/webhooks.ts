import 'server-only'

import crypto from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'

import { prisma } from '@/lib/prisma'

// --- SSRF egress guard ------------------------------------------------------
// Webhook URLs are user-supplied, so an outbound POST could be aimed at
// internal services (cloud metadata, localhost, RFC1918 ranges). Validate the
// scheme and reject any host that resolves to a private/reserved address.
// (A determined attacker can still DNS-rebind between this check and the fetch;
// pinning the resolved IP would close that, but this blocks the common cases.)
function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127) return true // this-host / private / loopback
    if (a === 169 && b === 254) return true // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true // private
    if (a === 192 && b === 168) return true // private
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast / reserved
    return false
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::1' || v6 === '::') return true
  if (v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd')) return true // link-local / ULA
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateAddress(mapped[1])
  return false
}

async function assertPublicWebhookUrl(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('invalid webhook url')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('webhook url must use http(s)')
  }
  // SSRF egress filtering guards against untrusted user URLs in production.
  // In dev/test we allow localhost so integration tests can deliver to a
  // local mock receiver.
  if (process.env.NODE_ENV !== 'production') return
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('webhook url targets a private host')
  }
  const resolved = await dnsLookup(host, { all: true }).catch(() => [])
  if (resolved.length === 0) throw new Error('webhook host does not resolve')
  for (const { address } of resolved) {
    if (isPrivateAddress(address)) throw new Error('webhook url resolves to a private/reserved address')
  }
}

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
    await assertPublicWebhookUrl(webhook.url)
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
