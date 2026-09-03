import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

// Host-dependent (points `sitemap:` at the requesting host's origin). Must be
// dynamic for the same reason as sitemap.ts.
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  // Every host — a store subdomain, a custom domain, the hosted apex — gets a
  // robots pointing at its own sitemap; the sitemap route decides what that
  // host actually lists.
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${h.get('host')}`

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/account', '/cart', '/checkout'],
    },
    sitemap: `${origin}/sitemap.xml`,
  }
}
