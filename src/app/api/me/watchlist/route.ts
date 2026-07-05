import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

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
  try {
    const item = await prisma.watchlistItem.create({
      data: { watchlistId: watchlist.id, symbol: parsed.data.symbol, note: parsed.data.note },
    })
    return NextResponse.json({ ok: true, item }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'already in watchlist' }, { status: 409 })
  }
}
