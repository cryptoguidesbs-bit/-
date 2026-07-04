import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MarketTicker } from '@/components/home/market-ticker'
import { HeroSection } from '@/components/home/hero-section'
import { AiBriefSection } from '@/components/home/ai-brief-section'
import { NewsSection } from '@/components/home/news-section'
import { MarketDashboardSection } from '@/components/home/market-dashboard-section'
import { WhySection } from '@/components/home/why-section'
import { DashboardPreviewSection } from '@/components/home/dashboard-preview-section'
import { PricingSection } from '@/components/home/pricing-section'
import { FaqSection } from '@/components/home/faq-section'
import { pageAlternates } from '@/lib/seo'

type Props = { params: { locale: string } }

export function generateMetadata({ params: { locale } }: Props): Metadata {
  return {
    alternates: pageAlternates('/', locale),
  }
}

export default function HomePage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  return (
    <>
      <MarketTicker />
      <HeroSection />
      <AiBriefSection />
      <NewsSection />
      <MarketDashboardSection />
      <WhySection />
      <DashboardPreviewSection />
      <PricingSection />
      <FaqSection />
    </>
  )
}
