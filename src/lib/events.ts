import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// First-party product events for the operator funnel (signups → brief
// readers → alert creators → waitlist). Deliberately minimal: an allowlist of
// names, optional userId (signed-in only), locale, path, small meta. No IP,
// no user agent, no third-party SDK. Writes are best-effort and never throw
// into the request that triggered them.
// ---------------------------------------------------------------------------

export const PRODUCT_EVENTS = [
  // page views (client-side, once per page load)
  'brief_view',
  'news_view',
  'map_view',
  'reports_view',
  'patterns_view',
  'onchain_view',
  'education_view',
  // actions (server-side, on success)
  'signup',
  'alert_rule_created',
  'watchlist_add',
  'waitlist_signup',
  'enterprise_inquiry',
  'paid_cta_click',
] as const
export type ProductEventName = (typeof PRODUCT_EVENTS)[number]

export function isProductEvent(name: string): name is ProductEventName {
  return (PRODUCT_EVENTS as readonly string[]).includes(name)
}

export async function recordEvent(input: {
  name: ProductEventName
  userId?: string | null
  locale?: string | null
  path?: string | null
  meta?: Record<string, string | number | boolean | null>
}): Promise<void> {
  try {
    await prisma.productEvent.create({
      data: {
        name: input.name,
        userId: input.userId ?? null,
        locale: input.locale ?? null,
        path: input.path ? input.path.slice(0, 200) : null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  } catch {
    // Analytics must never break the product path.
  }
}
