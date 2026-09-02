'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { EnterpriseContactDialog } from '@/components/home/enterprise-contact-dialog'

// Client island for the /enterprise page: opens the same Contact Sales
// dialog used by the pricing grid (POST /api/enterprise/inquiry).
export function EnterpriseCta({ label, size = 'lg' }: { label: string; size?: 'lg' | 'default' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} data-testid="enterprise-page-cta">
        {label}
      </Button>
      <EnterpriseContactDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
