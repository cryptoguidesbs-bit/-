import type { Metadata } from 'next'
import { ShieldAlert } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'

import { getDbUser } from '@/lib/user'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }

type Props = { params: { locale: string } }

// Operator console — ADMIN role only. Not linked from public navigation.
export default async function AdminPage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  const user = await getDbUser()
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex justify-center py-16" data-testid="admin-denied">
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
    <div className="space-y-6 py-6" data-testid="admin-page">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">운영 콘솔</h1>
        <p className="text-muted-foreground">
          회원·매출·파이프라인·지역 정책·로그를 한 곳에서 관리합니다. 이상 징후는 모니터가
          자동으로 감지해 알림을 보냅니다.
        </p>
      </div>
      <AdminDashboard />
    </div>
  )
}
