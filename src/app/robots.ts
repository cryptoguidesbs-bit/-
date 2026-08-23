import type { MetadataRoute } from 'next'

import { siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/ko/admin', '/en/admin', '/r/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
