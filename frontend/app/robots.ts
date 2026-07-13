import { siteConfig } from '@/lib/siteConfig'
import { MetadataRoute } from 'next'

// Driven by NEXT_PUBLIC_SITE_URL (see lib/siteConfig.ts). Set that env var in the
// hosting dashboard so the sitemap/host below point at the real domain.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Auth-gated / interactive app surfaces — no SEO value, keep out of the index.
        disallow: [
          '/admin',
          '/admin-dashboard',
          '/dashboard',
          '/profile',
          '/chat',
          '/ai-call',
          '/call-interface',
          '/peer-call',
          '/listener',
          '/listener-dashboard',
          '/therapist$',          // exact: the /therapist page only — NOT /therapists
          '/therapist-dashboard',
          '/auth/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
