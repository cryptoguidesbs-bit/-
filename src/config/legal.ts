// Legal document slugs. 'refund' has full published content; the others are
// placeholders until stage 22 (legal documents). The footer links here.
export const legalSlugs = ['terms', 'privacy', 'disclaimer', 'refund'] as const

export type LegalSlug = (typeof legalSlugs)[number]

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (legalSlugs as readonly string[]).includes(slug)
}
