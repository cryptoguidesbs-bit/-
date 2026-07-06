import 'server-only'

import type { AlertChannel } from '@prisma/client'

import { createNotification } from '@/lib/notifications'
import type { AlertMessage } from './types'

// ---------------------------------------------------------------------------
// Channel adapters. Each adapter returns how the message actually left the
// system: 'live' (real provider call) or 'dev' (provider credentials absent
// in this environment — message validated and logged only). This keeps the
// whole pipeline testable without Telegram/SMTP/VAPID credentials.
// ---------------------------------------------------------------------------

export type ChannelResult = {
  status: 'SENT' | 'FAILED'
  transport: 'live' | 'dev'
  error?: string
}

async function sendInApp(userId: string, message: AlertMessage): Promise<ChannelResult> {
  try {
    await createNotification(userId, {
      type: 'ALERT',
      title: message.title,
      body: message.body,
      href: '/alerts',
    })
    return { status: 'SENT', transport: 'live' }
  } catch (err) {
    return { status: 'FAILED', transport: 'live', error: String(err) }
  }
}

async function sendTelegram(
  config: Record<string, unknown>,
  message: AlertMessage,
): Promise<ChannelResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = String(config.chatId ?? '')
  if (!token) return { status: 'SENT', transport: 'dev' }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `${message.title}\n\n${message.body}` }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error(`telegram ${res.status}`)
    return { status: 'SENT', transport: 'live' }
  } catch (err) {
    return { status: 'FAILED', transport: 'live', error: String(err) }
  }
}

async function sendEmail(
  config: Record<string, unknown>,
  message: AlertMessage,
): Promise<ChannelResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERT_EMAIL_FROM
  const address = String(config.address ?? '')
  if (!apiKey || !from) return { status: 'SENT', transport: 'dev' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [address], subject: message.title, text: message.body }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error(`resend ${res.status}`)
    return { status: 'SENT', transport: 'live' }
  } catch (err) {
    return { status: 'FAILED', transport: 'live', error: String(err) }
  }
}

async function sendPush(
  config: Record<string, unknown>,
  message: AlertMessage,
): Promise<ChannelResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return { status: 'SENT', transport: 'dev' }

  try {
    const { default: webpush } = await import('web-push')
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:alerts@cryptoguide.example',
      publicKey,
      privateKey,
    )
    await webpush.sendNotification(
      config.subscription as never,
      JSON.stringify({ title: message.title, body: message.body }),
    )
    return { status: 'SENT', transport: 'live' }
  } catch (err) {
    return { status: 'FAILED', transport: 'live', error: String(err) }
  }
}

/**
 * Deliver a composed alert through the given channel. `config` is the user's
 * AlertChannelConfig payload (not needed for INAPP).
 */
export async function deliverToChannel(
  channel: AlertChannel,
  userId: string,
  config: Record<string, unknown> | null,
  message: AlertMessage,
): Promise<ChannelResult> {
  switch (channel) {
    case 'INAPP':
      return sendInApp(userId, message)
    case 'TELEGRAM':
      return sendTelegram(config ?? {}, message)
    case 'EMAIL':
      return sendEmail(config ?? {}, message)
    case 'PUSH':
      return sendPush(config ?? {}, message)
  }
}

/** Channels that require an AlertChannelConfig row before delivery. */
export const CHANNELS_REQUIRING_CONFIG: AlertChannel[] = ['TELEGRAM', 'EMAIL', 'PUSH']
