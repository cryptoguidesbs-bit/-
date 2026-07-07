import 'server-only'

import { createNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Renewal reminder (~3 days before, driven by Stripe's invoice.upcoming).
// Delivers an in-app notification and, when email credentials exist, an
// email. Without credentials it records a 'dev' transport (same pattern as
// the alert channels) so the flow is testable end-to-end.
// ---------------------------------------------------------------------------

export type ReminderResult = { notified: boolean; transport: 'live' | 'dev' | 'none' }

export async function sendRenewalReminder(input: {
  customerId: string | null
  amountDue: number
  currency: string
  renewalAt: Date | null
}): Promise<ReminderResult> {
  if (!input.customerId) return { notified: false, transport: 'none' }

  const sub = await prisma.subscription.findFirst({
    where: { externalCustomerId: input.customerId },
    include: { user: true },
  })
  if (!sub) return { notified: false, transport: 'none' }

  // Don't remind if the subscription is set to cancel — nothing renews.
  if (sub.cancelAtPeriodEnd) return { notified: false, transport: 'none' }

  const amount = `$${input.amountDue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  const dateStr = input.renewalAt ? input.renewalAt.toISOString().slice(0, 10) : ''
  const title = '구독 갱신 예정 안내'
  const body = `구독이 ${dateStr}에 갱신될 예정입니다. 청구 예정 금액: ${amount}. 갱신을 원치 않으시면 결제 관리에서 기간 말 해지를 설정할 수 있습니다.`

  await createNotification(sub.userId, { type: 'BILLING', title, body, href: '/billing' })

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERT_EMAIL_FROM
  if (!apiKey || !from) return { notified: true, transport: 'dev' }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [sub.user.email], subject: title, text: body }),
      signal: AbortSignal.timeout(8_000),
    })
    return { notified: true, transport: 'live' }
  } catch {
    return { notified: true, transport: 'dev' }
  }
}
