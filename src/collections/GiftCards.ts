import type { CollectionConfig } from 'payload'
import { perTenantUniqueField } from '@/fields/perTenantUniqueField'
import { NAV_GROUPS } from './nav-groups'

/**
 * A gift card: bearer value issued when a gift-card product is paid for.
 *
 * The plaintext code is NEVER stored — `codeHash` is an HMAC digest
 * (`src/lib/gift-cards/code.ts`) and `last4` is all the admin ever shows.
 *
 * `balance` is a cached projection of `gift-card-transactions`, which is the
 * truth. A test asserts they agree; without it this column becomes a second
 * source of truth, which is the defect `pricingContent` exists to remove
 * elsewhere in this codebase.
 *
 * A card spent to zero stays `active`. Voiding on exhaustion would leave a
 * later refund with nothing to restore.
 */
export const GiftCards: CollectionConfig = {
  slug: 'gift-cards',
  labels: { singular: 'Gift card', plural: 'Gift cards' },
  admin: {
    useAsTitle: 'last4',
    group: NAV_GROUPS.products,
    defaultColumns: ['last4', 'balance', 'currency', 'status', 'issuedAt'],
    description: 'Issued gift cards. Codes are never shown — only the last four characters.',
  },
  fields: [
    // perTenantUniqueField's Options don't take a bare `type` — its returned
    // field is always a required, indexed text field — but it does forward
    // `admin`, which is how the code hash stays readOnly and hidden from the
    // admin UI while still getting the shared per-tenant-uniqueness check.
    perTenantUniqueField({
      name: 'codeHash',
      collectionSlug: 'gift-cards',
      label: 'Code hash',
      admin: { readOnly: true, hidden: true },
    }),
    { name: 'last4', type: 'text', required: true, admin: { readOnly: true } },
    {
      name: 'initialAmount',
      type: 'number',
      required: true,
      min: 0,
      admin: { readOnly: true, description: 'Face value in minor units (e.g. fils/paise).' },
      validate: (v: number | null | undefined) =>
        v == null || Number.isInteger(v) ? true : 'Amount must be a whole number of minor units.',
    },
    {
      name: 'balance',
      type: 'number',
      required: true,
      min: 0,
      admin: { readOnly: true, description: 'Remaining balance in minor units. Derived from the ledger.' },
      validate: (v: number | null | undefined) =>
        v == null || Number.isInteger(v) ? true : 'Balance must be a whole number of minor units.',
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: 'Snapshotted at issue so a store currency change cannot revalue this card.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Void', value: 'void' },
      ],
      admin: { description: 'Void blocks redemption. A zero balance is NOT void — a refund can restore it.' },
    },
    { name: 'issuedFromOrder', type: 'relationship', relationTo: 'orders', admin: { readOnly: true } },
    { name: 'recipientName', type: 'text' },
    { name: 'recipientEmail', type: 'email' },
    { name: 'message', type: 'textarea' },
    { name: 'issuedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Always empty. Cards do not expire in this version; the field exists so adding expiry later is a behaviour change, not a migration.',
      },
    },
  ],
}
