import { getTranslations } from 'next-intl/server'

import { ENTERPRISE_FROM_MONTHLY, pricingTiers } from '@/config/pricing'
import { siteUrl } from '@/lib/site'

// Structured data for the home page: Organization + WebSite +
// SoftwareApplication (with the real pricing range) + FAQPage (mirrors the
// visible FAQ section, same message keys — they can't drift apart).
export async function HomeJsonLd({ locale }: { locale: string }) {
  const tMeta = await getTranslations({ locale, namespace: 'metadata' })
  const tFaq = await getTranslations({ locale, namespace: 'home.faq' })

  const faqEntities = Array.from({ length: 6 }, (_, i) => ({
    '@type': 'Question',
    name: tFaq(`q${i + 1}.question`),
    acceptedAnswer: { '@type': 'Answer', text: tFaq(`q${i + 1}.answer`) },
  }))

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'CryptoGuide',
        url: siteUrl,
        logo: `${siteUrl}/icon-512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: 'CryptoGuide',
        url: siteUrl,
        inLanguage: ['ko', 'en'],
        publisher: { '@id': `${siteUrl}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'CryptoGuide',
        url: siteUrl,
        description: tMeta('description'),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice: '0',
          highPrice: String(ENTERPRISE_FROM_MONTHLY),
          offerCount: pricingTiers.length,
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqEntities,
      },
    ],
  }

  // Static JSON built from our own translation strings and pricing config —
  // no user input reaches this markup. '<' is still escaped so a future copy
  // edit containing '</script' can't break out of the script element.
  const json = JSON.stringify(graph).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
