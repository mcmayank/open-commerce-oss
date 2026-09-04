/**
 * The collections that belong to a store.
 *
 * One list, two overlays: `withHosted()` wraps each of these with tenant
 * scoping (the multi-tenant plugin map is derived from it), `withSingleStore()`
 * (the OSS override) gives each plain authenticated access. Collections that
 * are not a store's data (users, and the hosted-only tenants/domains/voice
 * configs) are deliberately absent. `tenant-wiring.test.ts` keeps this and the
 * plugin map in step.
 */
export const STORE_COLLECTIONS = [
  'pages',
  'categories',
  'products',
  'media',
  'invoices',
  'store-settings',
  'gateway-configs',
  'voice-configs',
  'payment-attempts',
  'processed-webhook-events',
  'payment-gateway-requests',
  'customers',
  'orders',
  'discount-codes',
  'marketing-configs',
  'contacts',
  'campaigns',
  'section-definitions',
  'import-jobs',
  'import-items',
  'gift-cards',
  'gift-card-transactions',
] as const

export type StoreCollectionSlug = (typeof STORE_COLLECTIONS)[number]

export function isStoreCollection(slug: string): slug is StoreCollectionSlug {
  return (STORE_COLLECTIONS as readonly string[]).includes(slug)
}
