import { headers } from 'next/headers'
import { getStore } from '@/lib/storefront'
import { resolveStoreSlug } from '@/store-resolver'
import { requestOrigin } from '@/lib/export/origin'

/**
 * Resolve the current store from the request Host header — never from form
 * data. Shared by the storefront server actions (cart, checkout) so the lookup
 * exists in exactly one place: the store-resolver seam, which handles
 * `<slug>.<root>` subdomains, verified custom domains and single-tenant mode.
 * Returns null for the platform host or an unknown custom domain.
 */
export async function resolveStoreFromHost() {
  const headerStore = await headers()
  const slug = await resolveStoreSlug({
    headers: headerStore,
    // Protocol from `x-forwarded-proto`, not NODE_ENV — see requestOrigin.
    origin: requestOrigin(headerStore, headerStore.get('host')),
  })
  if (!slug) return null
  return getStore(slug)
}
