import type { CollectionConfig } from 'payload'
import { perTenantUniqueField } from '@/fields/perTenantUniqueField'
import { NAV_GROUPS } from './nav-groups'

/**
 * Customers collection — scoped per tenant.
 *
 * NOT auth-enabled: Payload's built-in auth forces global-unique email across
 * all tenants, which breaks multi-tenancy (two stores can have the same customer
 * email). Customer login / session management is handled separately.
 */
export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    group: NAV_GROUPS.customers,
    useAsTitle: 'email',
    defaultColumns: ['email', 'name'],
    description:
      'Customer records scoped per tenant. NOT auth-enabled — login is handled separately.',
  },
  fields: [
    perTenantUniqueField({
      name: 'email',
      collectionSlug: 'customers',
      label: 'Email',
    }),
    {
      name: 'name',
      type: 'text',
      admin: { description: "Customer's full name." },
    },
    {
      name: 'addresses',
      type: 'array',
      admin: { description: 'Saved shipping/billing addresses.' },
      fields: [
        { name: 'line1', type: 'text', required: true },
        { name: 'line2', type: 'text' },
        { name: 'city', type: 'text', required: true },
        { name: 'state', type: 'text' },
        { name: 'postalCode', type: 'text', required: true },
        { name: 'country', type: 'text', required: true },
      ],
    },
    {
      name: 'passwordHash',
      type: 'text',
      admin: { hidden: true, description: 'scrypt hash — never exposed via API.' },
      access: { read: () => false, create: () => false, update: () => false },
    },
    {
      name: 'magicLinkNonce',
      type: 'text',
      admin: { hidden: true, description: 'Rotating nonce for single-use magic-link tokens — never exposed.' },
      access: { read: () => false, create: () => false, update: () => false },
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
  ],
}
