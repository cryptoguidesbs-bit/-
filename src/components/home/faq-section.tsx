'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Section } from '@/components/home/section'
import { cn } from '@/lib/utils'

const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const

export function FaqSection() {
  const t = useTranslations('home.faq')
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <Section id="faq" title={t('title')} subtitle={t('subtitle')}>
      <div className="mx-auto max-w-3xl divide-y rounded-xl border">
        {FAQ_KEYS.map((key, index) => {
          const isOpen = openIndex === index
          return (
            <div key={key}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${index}`}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-secondary/40"
              >
                {t(`${key}.question`)}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              <div
                id={`faq-panel-${index}`}
                className={cn('accordion-panel', isOpen && 'is-open')}
                role="region"
              >
                <div>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {t(`${key}.answer`)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
