'use client'

import { useState } from 'react'
import { Download, ShieldAlert } from 'lucide-react'
import { useClerk } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// GDPR self-service controls: data portability (export) and right to erasure
// (account deletion). Deletion requires typing the confirmation word.
export function PrivacyControls() {
  const t = useTranslations('privacy')
  const { signOut } = useClerk()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportData = async () => {
    setBusy('export')
    setError(null)
    try {
      const res = await fetch('/api/me/export')
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cryptoguide-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('exportError'))
    } finally {
      setBusy(null)
    }
  }

  const deleteAccount = async () => {
    setBusy('delete')
    setError(null)
    try {
      const res = await fetch('/api/me/account', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      if (!res.ok) throw new Error('delete failed')
      await signOut({ redirectUrl: '/' })
    } catch {
      setError(t('deleteError'))
      setBusy(null)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-3xl" data-testid="privacy-controls">
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Data portability */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('exportTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('exportDescription')}</p>
          <Button variant="secondary" size="sm" disabled={busy !== null} onClick={exportData}>
            <Download className="mr-1.5 h-4 w-4" />
            {busy === 'export' ? t('exporting') : t('exportButton')}
          </Button>
        </div>

        {/* Right to erasure */}
        <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-400">
            <ShieldAlert className="h-4 w-4" />
            {t('deleteTitle')}
          </div>
          <p className="text-sm text-muted-foreground">{t('deleteDescription')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('deletePlaceholder')}
              className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-red-500"
              data-testid="delete-confirm-input"
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={confirm !== 'DELETE' || busy !== null}
              onClick={deleteAccount}
              data-testid="delete-account-button"
            >
              {busy === 'delete' ? t('deleting') : t('deleteButton')}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </CardContent>
    </Card>
  )
}
