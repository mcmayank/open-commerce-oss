import type { CollectionConfig } from 'payload'
import { perTenantUniqueField } from '@/fields/perTenantUniqueField'
import { NAV_GROUPS } from './nav-groups'

export const Contacts: CollectionConfig = {
  slug: 'contacts',
  admin: {
    group: NAV_GROUPS.contacts,
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'source'],
  },
  fields: [
    perTenantUniqueField({ name: 'email', collectionSlug: 'contacts', label: 'Email' }),
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'subscribed',
      options: [
        { label: 'Subscribed', value: 'subscribed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Checkout', value: 'checkout' },
        { label: 'Newsletter', value: 'newsletter' },
        { label: 'Import', value: 'import' },
        { label: 'Manual', value: 'manual' },
      ],
    },
    {
      name: 'unsubscribedAt',
      type: 'date',
    },
  ],
}
