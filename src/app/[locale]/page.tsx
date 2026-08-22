import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MarketTicker } from '@/components/home/market-ticker'
import { MapHeroSection } from '@/components/home/map-hero-section'
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

// The Crypto Map is the home page's main view (public); the marketing
// sections follow below it.
export default function HomePage({ params: { locale } }: Props) {
  setRequestLocale(locale)

  return (
    <>
      <MarketTicker />
      <MapHeroSection locale={locale} />
      <AiBriefSection locale={locale} />
      <NewsSection />
      <MarketDashboardSection />
      <WhySection locale={locale} />
      <DashboardPreviewSection />
      <PricingSection />
      <FaqSection />
    </>
  )
}
