import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { storeIdOf } from '@/store-scope'

export type TenantCacheKind = 'settings' | 'products' | 'pages' | 'categories' | 'voice'

export const storeBySlugTag = (slug: string): string => `store-by-slug:${slug}`

export const tenantTag = (tenantId: string | number, kind: TenantCacheKind): string =>
  `tenant:${tenantId}:${kind}`

/** Best-effort revalidate. Non-request writes (seed/scripts) call collection
 *  hooks outside a Next request scope, where revalidateTag throws — swallow it
 *  so those writes never fail.
 *
 *  `{ expire: 0 }` = immediate expiry: the merchant's edit shows on the very
 *  next storefront view (fresh cache miss), not one stale serve later. Next 16
 *  deprecated the single-arg form and requires a profile; the object form gives
 *  immediate invalidation, unlike the SWR string profiles ('max'/'default'). */
export function safeRevalidate(tag: string): void {
  try {
    revalidateTag(tag, { expire: 0 })
  } catch {
    // Not in a request scope (seed / one-off script); nothing to revalidate.
  }
}

/** afterChange/afterDelete for a tenant-scoped collection: purge the given
 *  cache kind for the changed doc's tenant. */
export function revalidateTenantHook(kind: TenantCacheKind): {
  afterChange: CollectionAfterChangeHook
  afterDelete: CollectionAfterDeleteHook
} {
  const purge = (doc: unknown) => {
    const tenantId = storeIdOf(doc as { tenant?: unknown })
    if (tenantId !== undefined) safeRevalidate(tenantTag(tenantId, kind))
  }
  return {
    afterChange: ({ doc }) => {
      purge(doc)
      return doc
    },
    afterDelete: ({ doc }) => {
      purge(doc)
      return doc
    },
  }
}

/** Tenants collection: purge the store-by-slug cache on slug rename / status
 *  change (and the previous slug when the slug changed). */
export const revalidateTenantSlugHook: {
  afterChange: CollectionAfterChangeHook
  afterDelete: CollectionAfterDeleteHook
} = {
  afterChange: ({ doc, previousDoc }) => {
    const slug = (doc as { slug?: unknown })?.slug
    if (typeof slug === 'string') safeRevalidate(storeBySlugTag(slug))
    const prevSlug = (previousDoc as { slug?: unknown } | undefined)?.slug
    if (typeof prevSlug === 'string' && prevSlug !== slug) safeRevalidate(storeBySlugTag(prevSlug))
    return doc
  },
  afterDelete: ({ doc }) => {
    const slug = (doc as { slug?: unknown })?.slug
    if (typeof slug === 'string') safeRevalidate(storeBySlugTag(slug))
    return doc
  },
}

/** Collections whose cached reads populate Media (depth 1–2): product images,
 *  page-block images, the store logo. A Media write must purge all of them. */
const MEDIA_DEPENDENT_KINDS: TenantCacheKind[] = ['products', 'pages', 'settings']

/** Media is populated into product/page/settings caches, so a media change
 *  (new upload, replaced file, alt-text edit) purges all three for the media's
 *  tenant — otherwise image/alt edits would lag until the TTL backstop. */
export const revalidateMediaHook: {
  afterChange: CollectionAfterChangeHook
  afterDelete: CollectionAfterDeleteHook
} = {
  afterChange: ({ doc }) => {
    purgeMediaDependents(doc)
    return doc
  },
  afterDelete: ({ doc }) => {
    purgeMediaDependents(doc)
    return doc
  },
}

function purgeMediaDependents(doc: unknown): void {
  const tenantId = storeIdOf(doc as { tenant?: unknown })
  if (tenantId === undefined) return
  for (const kind of MEDIA_DEPENDENT_KINDS) safeRevalidate(tenantTag(tenantId, kind))
}
