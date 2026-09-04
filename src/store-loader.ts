import { unstable_cache } from 'next/cache'
import { storeBySlugTag } from '@/lib/storefront-cache'
import { resolveStoreSlug } from '@/store-resolver'
import { loadStore } from '@/store-loader-overlay'

export type StoreStatus = 'active' | 'suspended'

/**
 * The store as core sees it. Hosted materialises this from a `tenants` row
 * (src/hosted/store-loader.ts); the OSS build synthesises the one store from
 * `store-settings` (oss/overrides/src/store-loader-overlay.ts). Core never
 * reads the `tenants` collection for identity — it asks for a Store.
 */
export interface Store {
  id: number
  slug: string
  name: string
  status: StoreStatus
  /** Theme id from src/themes; the registry resolves unknown ids to the default. */
  storefrontTheme: string
  /** Hosted plan id when there is one; the entitlements seam interprets it. */
  plan?: string | null
  /** Whether the storefront footer carries the "Powered by Niblr" line (src/lib/branding.ts). */
  showsPlatformBranding: boolean
}

const CACHE_TTL = 3600 // 1h backstop; storeBySlugTag handles immediate invalidation

/**
 * Status-blind store lookup by slug, cached under the slug tag so a status or
 * name change shows on the next request. Suspended stores come back with
 * `status: 'suspended'`; callers that must not serve them filter on it
 * (`getStore` in src/lib/storefront.ts does).
 */
export async function storeBySlug(slug: string): Promise<Store | null> {
  return unstable_cache(() => loadStore(slug), ['store-loader', 'storeBySlug', slug], {
    tags: [storeBySlugTag(slug)],
    revalidate: CACHE_TTL,
  })()
}

/**
 * The store an incoming request belongs to, or null when the host names no
 * store (hosted: the platform apex or an unknown domain; OSS: never null once
 * the store is set up). Status-blind: the admin of a suspended store still
 * has to reach its admin to appeal.
 */
export async function storeForHost(headers: Headers): Promise<Store | null> {
  const slug = await resolveStoreSlug({ headers })
  if (!slug) return null
  return storeBySlug(slug)
}
