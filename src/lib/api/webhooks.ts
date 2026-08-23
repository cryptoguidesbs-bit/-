import 'server-only'

import crypto from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

import { prisma } from '@/lib/prisma'

// --- SSRF egress guard ------------------------------------------------------
// Webhook URLs are user-supplied, so an outbound POST could be aimed at
// internal services (cloud metadata, localhost, RFC1918 ranges). Validate the
// scheme and reject any host that resolves to a private/reserved address.
// (A determined attacker can still DNS-rebind between this check and the fetch;
// pinning the resolved IP would close that, but this blocks the common cases.)
const PRIVATE_RANGES = new BlockList()
// IPv4: this-host, private, loopback, link-local (+ cloud metadata), CGNAT,
// benchmarking, multicast + reserved.
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.168.0.0', 16], ['100.64.0.0', 10], ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) PRIVATE_RANGES.addSubnet(net, prefix, 'ipv4')
// IPv6: unspecified, loopback, link-local, unique-local, discard, doc.
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['fe80::', 10], ['fc00::', 7], ['100::', 64], ['2001:db8::', 32],
] as const) PRIVATE_RANGES.addSubnet(net, prefix, 'ipv6')

/** Unwrap IPv4-mapped IPv6 (dotted or hex form) so v4 rules apply. */
function unmapIpv6(ip: string): string {
  const low = ip.toLowerCase()
  const dotted = low.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return dotted[1]
  const hex = low.match(/^(?:0*:)*:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const hi = parseInt(hex[1], 16)
    const lo = parseInt(hex[2], 16)
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  }
  return ip
}

export function isPrivateAddress(rawIp: string): boolean {
  const ip = unmapIpv6(rawIp.replace(/^\[|\]$/g, '').split('%')[0])
  const family = isIP(ip)
  if (family === 4) return PRIVATE_RANGES.check(ip, 'ipv4')
  if (family === 6) return PRIVATE_RANGES.check(ip, 'ipv6')
  return true // not an IP literal we understand → treat as unsafe
}

export async function assertPublicWebhookUrl(rawUrl: string): Promise<void> {
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
  if (isIP(host) && isPrivateAddress(host)) throw new Error('webhook url targets a private address')
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
      // Never follow redirects: a public URL could 302 to an internal address
      // after the DNS check. A 3xx counts as a failed delivery.
      redirect: 'manual',
    })
    result =
      res.status >= 300 && res.status < 400
        ? { delivered: false, status: res.status, error: 'redirect not followed' }
        : { delivered: res.ok, status: res.status }
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
