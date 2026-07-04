// Legal document slugs. Placeholder pages for now — real content lands in
// stage 22 (legal documents); the footer disclaimer links here.
export const legalSlugs = ['terms', 'privacy', 'disclaimer'] as const

export type LegalSlug = (typeof legalSlugs)[number]

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (legalSlugs as readonly string[]).includes(slug)
}
