import type { TextField } from 'payload'
import { storeWhere, storeIdOf } from '@/store-scope'

interface Options {
  name: string
  collectionSlug: string
  /** Human-readable label shown in error, e.g. "Email". Defaults to field name. */
  label?: string
  required?: boolean
  index?: boolean
  /** Passed through to the underlying text field's admin config (e.g. readOnly, hidden). */
  admin?: TextField['admin']
}

/**
 * A text field that is unique PER TENANT (not globally).
 * Uses a validate hook to query the same collection scoped to data.tenant
 * for a conflicting value, excluding the current document's id.
 *
 * Payload's `unique: true` enforces global uniqueness across all tenants,
 * which is incompatible with multi-tenant apps where each store needs its
 * own namespace. This helper is the correct pattern instead.
 *
 * Usage:
 *   perTenantUniqueField({ name: 'email', collectionSlug: 'customers', label: 'Email' })
 *   perTenantUniqueField({ name: 'code',  collectionSlug: 'discount-codes', label: 'Code' })
 */
export const perTenantUniqueField = ({
  name,
  collectionSlug,
  label,
  required = true,
  index = true,
  admin,
}: Options): TextField => ({
  name,
  type: 'text',
  required,
  index,
  ...(admin !== undefined ? { admin } : {}),
  validate: async (value: unknown, { req, data, id }: any) => {
    const displayLabel = label ?? name
    const strValue = String(value ?? '').trim()
    if (!strValue) return required ? `${displayLabel} is required.` : true

    const tenantId = storeIdOf(data)
    if (tenantId === undefined || !req?.payload) return true

    const conflict = await req.payload.find({
      collection: collectionSlug,
      where: {
        and: [
          storeWhere(tenantId),
          { [name]: { equals: strValue } },
          ...(id ? [{ id: { not_equals: id } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return conflict.totalDocs === 0
      ? true
      : `That ${displayLabel.toLowerCase()} is already used in this store.`
  },
})
