'use client'

import { useEffect, useRef, type RefObject } from 'react'

// Behaviour every modal dialog on the site shares: reset + focus the first
// field when (re)opened, close on Escape, lock body scroll while open. The
// markup stays in each dialog — only the effects are shared.
export function useDialogShell({
  open,
  onClose,
  initialFocusRef,
  onOpen,
}: {
  open: boolean
  onClose: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Called on each open, before focus — e.g. reset a submit status. */
  onOpen?: () => void
}) {
  // Keep the latest callback without re-running the open effect for it.
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useEffect(() => {
    if (!open) return
    onOpenRef.current?.()
    const id = window.setTimeout(() => initialFocusRef?.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, initialFocusRef])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])
}
