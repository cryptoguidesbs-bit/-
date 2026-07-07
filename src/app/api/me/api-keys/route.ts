import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkFeature } from '@/lib/entitlements'
import { generateApiKey } from '@/lib/api/keys'
import { getDbUser } from '@/lib/user'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_KEYS = 5

function gateResponse(gate: Awaited<ReturnType<typeof checkFeature>>) {
  return NextResponse.json(
    { error: 'forbidden', reason: gate.reason, requiredPlan: gate.requiredPlan },
    { status: gate.reason === 'auth' ? 401 : 403 },
  )
}

// GET /api/me/api-keys — my keys (prefix only, never the full key).
export async function GET() {
  const gate = await checkFeature('api.center')
  if (!gate.allowed) return gateResponse(gate)
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ keys })
}

const createSchema = z.object({ name: z.string().min(1).max(60) })

// POST /api/me/api-keys — issue a key. The full secret appears ONLY in this
// response; we store just the hash.
export async function POST(request: NextRequest) {
  const gate = await checkFeature('api.center')
  if (!gate.allowed) return gateResponse(gate)
  const user = await getDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid name' }, { status: 400 })

  const activeCount = await prisma.apiKey.count({
    where: { userId: user.id, revokedAt: null },
  })
  if (activeCount >= MAX_KEYS) {
    return NextResponse.json({ error: `key limit reached (${MAX_KEYS})` }, { status: 409 })
  }

  const { key, prefix, keyHash } = generateApiKey()
  const created = await prisma.apiKey.create({
    data: { userId: user.id, name: parsed.data.name, prefix, keyHash },
  })

  return NextResponse.json(
    {
      ok: true,
      key, // shown once — not retrievable later
      apiKey: { id: created.id, name: created.name, prefix: created.prefix },
    },
    { status: 201 },
  )
}
