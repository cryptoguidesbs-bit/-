import { NextRequest, NextResponse } from 'next/server'

import { REFERRAL } from '@/config/referral'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /r/:code — referral landing. Sets the attribution cookie (30 days,
// first-touch: an existing cookie is not overwritten) and redirects to the
// landing page. Unknown codes redirect without a cookie.
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.trim().toUpperCase()
  const response = NextResponse.redirect(new URL('/', request.url), 307)

  const found = await prisma.referralCode
    .findUnique({ where: { code }, select: { id: true } })
    .catch(() => null)
  if (!found) return response

  await prisma.referralCode
    .update({ where: { id: found.id }, data: { clicks: { increment: 1 } } })
    .catch(() => {})

  if (!request.cookies.get(REFERRAL.cookieName)) {
    response.cookies.set(REFERRAL.cookieName, code, {
      maxAge: REFERRAL.cookieMaxAgeDays * 86_400,
      path: '/',
      sameSite: 'lax',
    })
  }
  return response
}
