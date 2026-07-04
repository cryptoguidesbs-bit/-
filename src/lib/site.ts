// Canonical origin used for SEO metadata, the sitemap and robots.txt.
export const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
)
