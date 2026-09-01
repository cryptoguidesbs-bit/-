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
import { MapBonusSection } from '@/components/home/map-bonus-section'
import { FaqSection } from '@/components/home/faq-section'
import { HomeJsonLd } from '@/components/seo/home-json-ld'
import { pageAlternates } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  return {
    alternates: pageAlternates('/', locale),
  }
}

// Section order tells the story: value proposition (hero) → live proof
// (brief, news, markets) → why us → real screenshots → pricing → the map as
// a bonus → FAQ.
export default async function HomePage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  return (
    <>
      <HomeJsonLd locale={locale} />
      <MarketTicker />
      <HeroSection locale={locale} />
      <AiBriefSection locale={locale} />
      <NewsSection />
      <MarketDashboardSection />
      <WhySection locale={locale} />
      <DashboardPreviewSection locale={locale} />
      <PricingSection />
      <MapBonusSection locale={locale} />
      <FaqSection />
    </>
  )
}
