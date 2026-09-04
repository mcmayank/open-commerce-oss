import type { CollectionConfig } from 'payload'
import { NAV_GROUPS } from './nav-groups'

/**
 * Append-only ledger for gift card movements. THIS is the truth; the `balance`
 * column on `gift-cards` is a cached projection of it.
 *
 * `issue`   — card minted, amount is the face value
 * `redeem`  — balance reserved against an order
 * `reverse` — a redemption undone: refunded order, or an abandoned checkout
 *
 * Rows are never updated or deleted. A correction is another row.
 */
export const GiftCardTransactions: CollectionConfig = {
  slug: 'gift-card-transactions',
  labels: { singular: 'Gift card transaction', plural: 'Gift card transactions' },
  admin: {
    useAsTitle: 'type',
    group: NAV_GROUPS.products,
    defaultColumns: ['giftCard', 'type', 'amount', 'order', 'createdAt'],
  },
  fields: [
    { name: 'giftCard', type: 'relationship', relationTo: 'gift-cards', required: true, index: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Issue', value: 'issue' },
        { label: 'Redeem', value: 'redeem' },
        { label: 'Reverse', value: 'reverse' },
      ],
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Always positive, in minor units. `type` carries the direction.' },
      validate: (v: number | null | undefined) =>
        v == null || Number.isInteger(v) ? true : 'Amount must be a whole number of minor units.',
    },
    { name: 'order', type: 'relationship', relationTo: 'orders' },
  ],
}
