import type { CollectionConfig } from 'payload'
import { hiddenFromTenantNav } from '@/access/roles'

/**
 * payment-gateway-requests — merchants can request a provider we don't yet
 * support. The platform team triages these (status) to prioritise the roadmap.
 * Tenant-scoped so each store only sees its own requests; the status field is
 * managed by the platform.
 */
export const PaymentGatewayRequests: CollectionConfig = {
  slug: 'payment-gateway-requests',
  labels: { singular: 'Provider request', plural: 'Provider requests' },
  admin: {
    useAsTitle: 'providerName',
    group: 'Payments',
    hidden: hiddenFromTenantNav,
    defaultColumns: ['providerName', 'status', 'createdAt'],
  },
  fields: [
    {
      name: 'providerName',
      type: 'text',
      required: true,
      admin: { description: 'The payment provider the merchant would like added.' },
    },
    {
      name: 'note',
      type: 'textarea',
      admin: { description: 'Optional context (country, why they need it, volume).' },
    },
    {
      name: 'requestedByEmail',
      type: 'text',
      admin: { readOnly: true, description: 'Email of the admin who submitted the request.' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewing', value: 'reviewing' },
        { label: 'Planned', value: 'planned' },
        { label: 'Declined', value: 'declined' },
      ],
      admin: { description: 'Platform triage status.' },
    },
  ],
}
