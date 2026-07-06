'use client'

import { Bookmark } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

export function SaveReportButton({ reportId }: { reportId: string }) {
  const t = useTranslations('reports')
  const { isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['me', 'saved-reports'],
    queryFn: async () => {
      const res = await fetch('/api/me/saved-reports')
      if (!res.ok) throw new Error('saved fetch failed')
      return (await res.json()) as { items: { reportId: string }[] }
    },
    enabled: !!isSignedIn,
  })
  const saved = data?.items.some((item) => item.reportId === reportId) ?? false

  const toggle = useMutation({
    mutationFn: async () => {
      if (saved) {
        await fetch(`/api/me/saved-reports/${reportId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/me/saved-reports', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reportId }),
        })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'saved-reports'] }),
  })

  if (!isSignedIn) return null

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={toggle.isPending}
      onClick={() => toggle.mutate()}
      data-testid="save-report"
    >
      <Bookmark className={saved ? 'mr-1.5 h-4 w-4 fill-primary text-primary' : 'mr-1.5 h-4 w-4'} />
      {saved ? t('unsave') : t('save')}
    </Button>
  )
}
