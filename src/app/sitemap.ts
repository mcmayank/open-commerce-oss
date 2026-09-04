import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { resolveStoreSlug } from '@/store-resolver'
import { platformSitemap } from '@/sitemap-overlay'
import { getStore, listProducts, listPublishedPages } from '@/lib/storefront'

// Host-dependent: the same file serves every store host (and, hosted, the
// platform apex). MUST be dynamic so Next computes it per request instead of
// baking one host's URLs at build time and serving them to all hosts.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const base = `${proto}://${h.get('host')}`

  // The store is whatever the host resolves to; a host that names no store is
  // the marketing apex, whose sitemap lives in the hosted overlay (the OSS
  // build has no apex and returns nothing there).
  const slug = await resolveStoreSlug({ headers: h, origin: base })
  if (!slug) return platformSitemap()

  const store = await getStore(slug)
  if (!store) return []

  const [pages, products] = await Promise.all([
    listPublishedPages(store.id),
    listProducts(store.id, { limit: 1000 }),
  ])

  return [
    { url: `${base}/`, changeFrequency: 'weekly' as const },
    { url: `${base}/products`, changeFrequency: 'weekly' as const },
    ...pages.map((p) => ({ url: `${base}/${p.slug}`, lastModified: p.updatedAt })),
    ...products
      .filter((p) => p.slug)
      .map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt })),
  ]
}
