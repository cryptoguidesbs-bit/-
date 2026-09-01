import type { Metadata } from 'next'
import { ShieldAlert } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'

import { getDbUser } from '@/lib/user'
import { AdminBoard } from '@/components/admin/admin-board'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Board', robots: { index: false } }

type Props = { params: Promise<{ locale: string }> }

// Operator wall-board ("dashboard mode") — ADMIN role only. Big numbers,
// auto-refresh, meant to stay open full-screen on a monitor.
export default async function AdminBoardPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  const user = await getDbUser()
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex justify-center py-16" data-testid="admin-denied" lang="ko" translate="no">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold">관리자 전용 페이지</h1>
            <p className="text-sm text-muted-foreground">
              이 페이지는 운영자 계정으로만 접근할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="py-4" data-testid="admin-board-page" lang="ko" translate="no">
      <AdminBoard />
    </div>
  )
}
