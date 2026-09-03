import type { CollectionConfig } from 'payload'
import { hiddenFromTenantNav } from '@/access/roles'

/**
 * processed-webhook-events — the idempotency backstop for webhook retries.
 *
 * `(tenant, provider, providerEventId)` is unique. Reconciliation inserts a row
 * as its FIRST step; a duplicate-key violation means "already processed" → the
 * webhook is acknowledged (200) and no side-effects run again. This is what
 * makes provider retries safe and fulfilment exactly-once.
 *
 * Store-scoped so an event id can never collide across tenants.
 */
export const ProcessedWebhookEvents: CollectionConfig = {
  slug: 'processed-webhook-events',
  labels: { singular: 'Webhook event', plural: 'Webhook events' },
  admin: {
    useAsTitle: 'providerEventId',
    group: 'Payments',
    hidden: hiddenFromTenantNav,
    defaultColumns: ['provider', 'providerEventId', 'createdAt'],
  },
  // Per-store; hosted prefixes `tenant` (TENANT_INDEXES in src/hosted/config.ts).
  indexes: [{ fields: ['provider', 'providerEventId'], unique: true }],
  fields: [
    {
      name: 'provider',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'providerEventId',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: "Provider's unique webhook event id." },
    },
    {
      name: 'paymentAttempt',
      type: 'relationship',
      relationTo: 'payment-attempts',
      admin: { readOnly: true },
    },
  ],
}
