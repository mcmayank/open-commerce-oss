import type { CollectionConfig } from 'payload'
import type { Field } from 'payload'
import { hiddenFromTenantNav } from '@/access/roles'

/** Integer minor-unit amount field (paise/cents), matching Orders convention. */
const amountField = (name: string): Field => ({
  name,
  type: 'number',
  min: 0,
  admin: { readOnly: true, description: 'Amount in minor units (e.g. paise/cents).' },
  validate: (value: number | null | undefined) =>
    value == null || Number.isInteger(value)
      ? true
      : 'Amount must be a whole number of minor units.',
})

/**
 * payment-attempts — the store-scoped index and retry ledger.
 *
 * This is OUR OWN lookup key: webhook reconciliation resolves an order through
 * `(tenant, provider, providerSessionId)` here, NEVER through provider metadata.
 * Because the index is store-scoped, a webhook arriving at Store A's endpoint
 * physically cannot resolve a Store B order.
 *
 * `(order, idempotencyKey)` is unique — this, not the provider, is our
 * idempotency guarantee (Razorpay/Mollie have no native equivalent). A retry is
 * a NEW attempt row on the SAME order with a fresh idempotency key.
 *
 * NEVER stores card data. All rows are created/updated server-side.
 */
export const PaymentAttempts: CollectionConfig = {
  slug: 'payment-attempts',
  admin: {
    useAsTitle: 'providerSessionId',
    group: 'Payments',
    defaultColumns: ['order', 'provider', 'status', 'amount', 'createdAt'],
    // Attempts are a system ledger — never hand-edited.
    hidden: hiddenFromTenantNav,
  },
  indexes: [
    // Per-store; hosted prefixes `tenant` (TENANT_INDEXES in src/hosted/config.ts).
    { fields: ['provider', 'providerSessionId'], unique: true },
    { fields: ['order', 'idempotencyKey'], unique: true },
  ],
  fields: [
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'provider',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: 'Registry provider slug (e.g. stripe, razorpay, offline).' },
    },
    {
      name: 'providerSessionId',
      type: 'text',
      admin: { readOnly: true, description: "Provider's session/link id (cs_… / plink_…). Our lookup key." },
    },
    {
      name: 'idempotencyKey',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: 'Our idempotency key for this attempt.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'created',
      options: [
        { label: 'Created', value: 'created' },
        { label: 'Redirected', value: 'redirected' },
        { label: 'Pending', value: 'pending' },
        { label: 'Authorized', value: 'authorized' },
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Expired', value: 'expired' },
      ],
      admin: { readOnly: true },
    },
    amountField('amount'),
    {
      name: 'currency',
      type: 'text',
      admin: { readOnly: true, description: '3-letter ISO 4217 code.' },
    },
    {
      name: 'providerPaymentId',
      type: 'text',
      admin: { readOnly: true, description: "Provider's payment id (pay_… / pi_…) once known." },
    },
    { name: 'failureCode', type: 'text', admin: { readOnly: true } },
    { name: 'failureMessage', type: 'text', admin: { readOnly: true } },
  ],
}
