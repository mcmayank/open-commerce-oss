import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import config from '@payload-config'
import { getPayload } from 'payload'
import { storeOrigin } from '@/store-origin-overlay'
import { storeBySlug, storeForHost, type Store } from '@/store-loader'
import { tenantTag } from '@/lib/storefront-cache'
import type { Where } from 'payload'
import type { Category, Order, Page, Product, StoreSetting } from '@/payload-types'
import { storeWhere } from '@/store-scope'

const payloadPromise = getPayload({ config })

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'lvh.me:3000'

const CACHE_TTL = 3600 // 1h backstop; tags handle immediate invalidation

/** Absolute origin for a store's storefront: hosted `https://acme.niblr.store`, single-store its own domain. */
export function storeBaseUrl(slug: string): string {
  return storeOrigin(slug)
}

export type { Store }

/** Resolve the active store from the incoming request host. Null for hosts that name no store, and for suspended stores. */
export async function resolveStoreFromHost(): Promise<Store | null> {
  const store = await storeForHost(await headers())
  return store?.status === 'active' ? store : null
}

/** The active store with this slug. Suspended stores are null here; see getTenantStatusBySlug. */
export async function getStore(slug: string): Promise<Store | null> {
  const store = await storeBySlug(slug)
  return store?.status === 'active' ? store : null
}

/**
 * Status-blind lookup of a tenant's status by slug. `getStore` deliberately
 * returns null for anything not `active`, which makes a suspended store look
 * identical to one that never existed. This lets the storefront tell the two
 * apart on the miss path so a suspended store can show a "temporarily
 * unavailable" holding page (and its owner an appeal path) instead of a bare
 * 404. Shares the store-by-slug cache tag, so a status change revalidates it.
 */
export async function getTenantStatusBySlug(slug: string): Promise<'active' | 'suspended' | null> {
  return (await storeBySlug(slug))?.status ?? null
}

export async function getStoreSettings(tenantId: string | number): Promise<StoreSetting | null> {
  return unstable_cache(
    async () => {
      const payload = await payloadPromise
      const { docs } = await payload.find({
        collection: 'store-settings',
        where: storeWhere(tenantId),
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
      return docs[0] ?? null
    },
    ['storefront', 'getStoreSettings', String(tenantId)],
    { tags: [tenantTag(tenantId, 'settings')], revalidate: CACHE_TTL },
  )()
}

export async function listProducts(
  tenantId: string | number,
  opts: { categoryId?: string | number; limit?: number } = {},
): Promise<Product[]> {
  return unstable_cache(
    async () => {
      const payload = await payloadPromise
      const and: Where[] = [storeWhere(tenantId), { status: { equals: 'active' } }]
      if (opts.categoryId) and.push({ category: { equals: opts.categoryId } })
      const where: Where = { and }
      const { docs } = await payload.find({
        collection: 'products',
        where,
        limit: opts.limit ?? 24,
        depth: 1,
        overrideAccess: true,
      })
      return docs
    },
    ['storefront', 'listProducts', String(tenantId), JSON.stringify(opts)],
    { tags: [tenantTag(tenantId, 'products')], revalidate: CACHE_TTL },
  )()
}

/**
 * Text search across a store's active catalogue.
 *
 * Added for the voice assistant, which needs "find me sourdough" and cannot use
 * `listProducts` — that filters by category only. A plain `contains` on the
 * title, not full-text search: the caller is an agent that will happily rephrase
 * and try again, so recall matters more than ranking, and this needs no index
 * or extension to ship.
 *
 * Shares the `products` cache tag, so a catalogue edit invalidates searches too.
 */
export async function searchProducts(
  tenantId: string | number,
  query: string,
  opts: { categoryId?: string | number; limit?: number } = {},
): Promise<Product[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 10))
  return unstable_cache(
    async () => {
      const payload = await payloadPromise
      const and: Where[] = [
        storeWhere(tenantId),
        { status: { equals: 'active' } },
        { title: { contains: trimmed } },
      ]
      if (opts.categoryId) and.push({ category: { equals: opts.categoryId } })
      const where: Where = { and }
      const { docs } = await payload.find({
        collection: 'products',
        where,
        limit,
        depth: 0,
        overrideAccess: true,
      })
      return docs
    },
    ['storefront', 'searchProducts', String(tenantId), trimmed, JSON.stringify(opts)],
    { tags: [tenantTag(tenantId, 'products')], revalidate: CACHE_TTL },
  )()
}

export async function getProductBySlug(
  tenantId: string | number,
  slug: string,
): Promise<Product | null> {
  return unstable_cache(
    async () => {
      const payload = await payloadPromise
      const { docs } = await payload.find({
        collection: 'products',
        where: {
          and: [
            storeWhere(tenantId),
            { slug: { equals: slug } },
            { status: { equals: 'active' } },
          ],
        },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
      return docs[0] ?? null
    },
    ['storefront', 'getProductBySlug', String(tenantId), slug],
    { tags: [tenantTag(tenantId, 'products')], revalidate: CACHE_TTL },
  )()
}

export async function getProductsByIds(
  tenantId: string | number,
  ids: (string | number)[],
): Promise<Product[]> {
  if (ids.length === 0) return []
  const payload = await payloadPromise
  const { docs } = await payload.find({
    collection: 'products',
    where: {
      and: [
        storeWhere(tenantId),
        { id: { in: ids } },
        { status: { equals: 'active' } },
      ],
    },
    limit: ids.length,
    depth: 1,
    overrideAccess: true,
  })
  return docs
}

export async function getPageBySlug(tenantId: string | number, slug: string): Promise<Page | null> {
  return unstable_cache(
    async () => {
      const payload = await payloadPromise
      const { docs } = await payload.find({
        collection: 'pages',
        where: {
          and: [
            storeWhere(tenantId),
            { slug: { equals: slug } },
            { _status: { equals: 'published' } },
          ],
        },
        limit: 1,
        depth: 2, // populate block relations (images, product refs)
        overrideAccess: true,
      })
      return docs[0] ?? null
    },
    ['storefront', 'getPageBySlug', String(tenantId), slug],
    { tags: [tenantTag(tenantId, 'pages')], revalidate: CACHE_TTL },
  )()
}

/** Draft-aware page fetch for preview only. Returns the latest version
 *  (draft or published) and is intentionally NOT cached — unpublished content
 *  must never be served to real visitors or persisted in a shared cache. */
export async function getDraftPageBySlug(
  tenantId: string | number,
  slug: string,
): Promise<Page | null> {
  const payload = await payloadPromise
  const { docs } = await payload.find({
    collection: 'pages',
    where: {
      and: [storeWhere(tenantId), { slug: { equals: slug } }],
    },
    draft: true,
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

/**
 * Published, indexable CMS pages for a tenant, for sitemap generation. Excludes
 * the special `home` page (served at `/`, added separately) and any `noindex`
 * page. Returns route slugs plus last-modified timestamps.
 */
export async function listPublishedPages(
  tenantId: string | number,
): Promise<{ slug: string; updatedAt: string }[]> {
  const payload = await payloadPromise
  const { docs } = await payload.find({
    collection: 'pages',
    where: { and: [storeWhere(tenantId), { _status: { equals: 'published' } }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return docs
    .filter((d) => d.slug && d.slug !== 'home' && !d.noindex)
    .map((d) => ({ slug: d.slug as string, updatedAt: d.updatedAt }))
}

export async function listCategories(tenantId: string | number): Promise<Category[]> {
  return unstable_cache(
    async () => {
      const payload = await payloadPromise
      const { docs } = await payload.find({
        collection: 'categories',
        where: storeWhere(tenantId),
        limit: 100,
        overrideAccess: true,
      })
      return docs
    },
    ['storefront', 'listCategories', String(tenantId)],
    { tags: [tenantTag(tenantId, 'categories')], revalidate: CACHE_TTL },
  )()
}

/**
 * Fetch orders for a customer, including guest orders placed before account registration.
 * Matches by tenant AND (linked customer id OR buyer email snapshot).
 */
export async function getCustomerOrders(
  tenantId: string | number,
  customer: { id: string | number; email: string },
): Promise<Order[]> {
  const payload = await payloadPromise
  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        storeWhere(tenantId),
        { or: [{ customer: { equals: customer.id } }, { email: { equals: customer.email } }] },
      ],
    },
    sort: '-createdAt',
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  return docs
}
