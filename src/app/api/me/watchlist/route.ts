import { NextRequest, NextResponse } from 'next/server'
import { recordEvent } from '@/lib/events'
import { z } from 'zod'

import { resolvePlanAndRole } from '@/lib/entitlements'
import { checkLimit, limitResponse } from '@/lib/entitlements/limits'
import { getUsdQuotes } from '@/lib/market/quotes'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getDefaultWatchlist(userId: string) {
  const existing = await prisma.watchlist.findFirst({ where: { userId } })
  if (existing) return existing
  return prisma.watchlist.create({ data: { userId, name: 'Default' } })
}

// GET /api/me/watchlist — items enriched with live USD prices.
export async function GET() {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const watchlist = await getDefaultWatchlist(user.id)
  const items = await prisma.watchlistItem.findMany({
    where: { watchlistId: watchlist.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  const quotes = await getUsdQuotes(items.map((i) => i.symbol))

  return NextResponse.json({
    id: watchlist.id,
    items: items.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      note: item.note,
      price: quotes[item.symbol.toUpperCase()] ?? null,
    })),
  })
}

const addSchema = z.object({
  symbol: z
    .string()
    .regex(/^[A-Za-z0-9]{2,10}$/)
    .transform((s) => s.toUpperCase()),
  note: z.string().max(200).optional(),
})

// POST /api/me/watchlist — add a symbol.
export async function POST(request: NextRequest) {
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = addSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid symbol' }, { status: 400 })
  }

  const watchlist = await getDefaultWatchlist(user.id)

  // Per-plan cap (config/limits.ts). The watchlist is open to every member,
  // so resolve the plan here (no feature gate on this route).
  const [{ plan }, used] = await Promise.all([
    resolvePlanAndRole(),
    prisma.watchlistItem.count({ where: { watchlistId: watchlist.id } }),
  ])
  const cap = checkLimit(plan, 'watchlistItems', used)
  if (!cap.allowed) return limitResponse(cap)

  try {
    const item = await prisma.watchlistItem.create({
      data: { watchlistId: watchlist.id, symbol: parsed.data.symbol, note: parsed.data.note },
    })
    await recordEvent({ name: 'watchlist_add', userId: user.id, meta: { symbol: item.symbol } })
    return NextResponse.json({ ok: true, item }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'already in watchlist' }, { status: 409 })
  }
}
