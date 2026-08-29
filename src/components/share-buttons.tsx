'use client'

import { useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

// Lightweight share row for public content (daily brief, later reports).
// X share uses the plain web intent — no SDK, nothing loaded from X.
export function ShareButtons({ text, path }: { text: string; path: string }) {
  const t = useTranslations('common')
  const [copied, setCopied] = useState(false)

  const pageUrl = () => `${window.location.origin}${path}`

  const shareOnX = () => {
    const intent = new URL('https://twitter.com/intent/tweet')
    intent.searchParams.set('text', text)
    intent.searchParams.set('url', pageUrl())
    window.open(intent.toString(), '_blank', 'noopener,noreferrer,width=560,height=640')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable (e.g. insecure context) — silently ignore */
    }
  }

  return (
    <div className="flex items-center gap-2" data-testid="share-buttons">
      <Button variant="outline" size="sm" onClick={shareOnX} className="gap-1.5" translate="no">
        <Share2 className="h-3.5 w-3.5" />
        {t('shareX')}
      </Button>
      <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? t('copied') : t('copyLink')}
      </Button>
    </div>
  )
}
