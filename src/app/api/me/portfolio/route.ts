import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkFeature } from '@/lib/entitlements'
import { getUsdQuotes } from '@/lib/market/quotes'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Portfolio tools are a Professional+ feature (A-3 matrix).
async function gatePortfolio() {
  const gate = await checkFeature('portfolio.tools')
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
      { status: gate.reason === 'auth' ? 401 : 403 },
    )
  }
  return null
}

async function getDefaultPortfolio(userId: string) {
  const existing = await prisma.portfolio.findFirst({ where: { userId } })
  if (existing) return existing
  return prisma.portfolio.create({
    data: { userId, name: 'Default', currency: 'USD', isDefault: true },
  })
}

// GET /api/me/portfolio — holdings with live valuation.
export async function GET() {
  const gateError = await gatePortfolio()
  if (gateError) return gateError
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const portfolio = await getDefaultPortfolio(user.id)
  const items = await prisma.portfolioItem.findMany({
    where: { portfolioId: portfolio.id },
    orderBy: { createdAt: 'asc' },
  })
  const quotes = await getUsdQuotes(items.map((i) => i.symbol))

  let totalValue = 0
  let totalCost = 0
  const enriched = items.map((item) => {
    const quantity = Number(item.quantity)
    const avgCost = Number(item.avgCost)
    const price = quotes[item.symbol.toUpperCase()] ?? null
    const value = price !== null ? quantity * price : null
    if (value !== null) totalValue += value
    totalCost += quantity * avgCost
    return {
      id: item.id,
      symbol: item.symbol,
      quantity,
      avgCost,
      note: item.note,
      price,
      value,
    }
  })

  return NextResponse.json({
    id: portfolio.id,
    currency: 'USD',
    items: enriched,
    totalValue,
    totalCost,
  })
}

const addSchema = z.object({
  symbol: z
    .string()
    .regex(/^[A-Za-z0-9]{2,10}$/)
    .transform((s) => s.toUpperCase()),
  quantity: z.number().positive().max(1e12),
  avgCost: z.number().min(0).max(1e12),
  note: z.string().max(200).optional(),
})

// POST /api/me/portfolio — add (or replace) a holding.
export async function POST(request: NextRequest) {
  const gateError = await gatePortfolio()
  if (gateError) return gateError
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = addSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid holding' }, { status: 400 })
  }

  const portfolio = await getDefaultPortfolio(user.id)
  const item = await prisma.portfolioItem.upsert({
    where: {
      portfolioId_symbol: { portfolioId: portfolio.id, symbol: parsed.data.symbol },
    },
    update: {
      quantity: parsed.data.quantity,
      avgCost: parsed.data.avgCost,
      note: parsed.data.note,
    },
    create: {
      portfolioId: portfolio.id,
      symbol: parsed.data.symbol,
      quantity: parsed.data.quantity,
      avgCost: parsed.data.avgCost,
      currency: 'USD',
      note: parsed.data.note,
    },
  })
  return NextResponse.json({ ok: true, item: { ...item, quantity: Number(item.quantity), avgCost: Number(item.avgCost) } }, { status: 201 })
}
