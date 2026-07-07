'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Lightweight scroll-in reveal — a ~1KB IntersectionObserver leaf replacing
// framer-motion's whileInView on the landing page. Reveals once, then
// disconnects. Honors prefers-reduced-motion via CSS.
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  /** Stagger delay in ms. */
  delay?: number
  as?: 'div' | 'li'
}) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '-60px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      className={cn('reveal', visible && 'is-visible', className)}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  )
}
