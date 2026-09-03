import type { Field } from 'payload'
import { isValidSlugFormat } from '@/lib/slug'
import { storeWhere, storeIdOf } from '@/store-scope'

/**
 * A `slug` text field that is unique PER TENANT (Payload's `unique: true` is
 * global across tenants, so it is not used here). Validates format, then queries
 * the same collection scoped to the row's tenant for a conflicting slug.
 *
 * `opts.reserved` blocks slugs that would collide with fixed storefront routes
 * (e.g. Pages render at `/<slug>`, so a page slug of `cart` or `products` would
 * be shadowed by those routes and unreachable). Reserved words are matched
 * case-insensitively against the normalized slug.
 */
export const perTenantSlugField = (
  collectionSlug: string,
  opts: {
    reserved?: string[]
    /** Products only: derive the slug from the title while it's an untouched draft. */
    autoDerive?: boolean
    /** Move the field out of the main column. */
    position?: 'sidebar'
  } = {},
): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  index: true,
  admin: {
    description: 'URL-safe, unique within this store. Lowercase letters, numbers, hyphens.',
    // Both opt-in: this field is shared with Pages, which must keep the plain
    // text input in the main column.
    ...(opts.position ? { position: opts.position } : {}),
    ...(opts.autoDerive ? { components: { Field: '@/components/admin/SlugField' } } : {}),
  },
  validate: async (value: unknown, { req, data, id }: any) => {
    const slug = String(value ?? '')
    if (!isValidSlugFormat(slug)) {
      return 'Slug must be 2-60 chars: lowercase letters, numbers, and single hyphens (not at the start or end).'
    }
    if (opts.reserved?.includes(slug)) {
      return `"${slug}" is a reserved word and can't be used as a slug — it would clash with a built-in store page. Please choose another.`
    }
    const tenantId = storeIdOf(data)
    if (tenantId === undefined || !req?.payload) return true
    const conflict = await req.payload.find({
      collection: collectionSlug,
      where: {
        and: [
          storeWhere(tenantId),
          { slug: { equals: slug } },
          ...(id ? [{ id: { not_equals: id } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return conflict.totalDocs === 0 ? true : 'That slug is already used in this store.'
  },
})
