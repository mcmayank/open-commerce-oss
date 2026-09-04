import type { CollectionConfig } from 'payload'
import type { Field } from 'payload'
import { perTenantUniqueField } from '@/fields/perTenantUniqueField'
import { NAV_GROUPS } from './nav-groups'

const intField = (
  name: string,
  options: { required?: boolean; min?: number; description?: string } = {},
): Field => ({
  name,
  type: 'number',
  required: options.required ?? false,
  ...(options.min !== undefined ? { min: options.min } : {}),
  ...(options.description !== undefined ? { admin: { description: options.description } } : {}),
  validate: (value: unknown) =>
    value == null || Number.isInteger(value) ? true : `${name} must be a whole number.`,
})

/**
 * DiscountCodes collection — tenant-scoped.
 *
 * `code` is unique per tenant (not globally) via perTenantUniqueField.
 * `value` is an integer: for percent type it's a whole percentage (10 = 10%);
 * for fixed type it's minor units (500 = ₹5.00).
 *
 * Enforcement logic lives in src/lib/discount.ts (applyDiscount).
 */
export const DiscountCodes: CollectionConfig = {
  slug: 'discount-codes',
  labels: { singular: 'Discount', plural: 'Discounts' },
  admin: {
    group: NAV_GROUPS['discount-codes'],
    useAsTitle: 'code',
    defaultColumns: ['code', 'type', 'value', 'active'],
  },
  fields: [
    perTenantUniqueField({
      name: 'code',
      collectionSlug: 'discount-codes',
      label: 'Code',
    }),
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Percentage', value: 'percent' },
        { label: 'Fixed Amount', value: 'fixed' },
      ],
    },
    {
      name: 'value',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description:
          'For percent: whole percentage (e.g. 10 = 10%). For fixed: minor units (e.g. 500 = ₹5.00).',
      },
      validate: (value: unknown) =>
        value == null || Number.isInteger(value)
          ? true
          : 'Value must be a whole number (percent: 10 = 10%; fixed: minor units).',
    },
    intField('minOrder', {
      min: 0,
      description: 'Minimum subtotal (minor units) required to use this code.',
    }),
    {
      name: 'usageLimit',
      type: 'number',
      min: 1,
      admin: { description: 'Maximum total uses. Leave blank for unlimited.' },
      validate: (value: unknown) =>
        value == null || Number.isInteger(value) ? true : 'Usage limit must be a whole number.',
    },
    {
      name: 'usedCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: 'Automatically incremented on each successful use.' },
      validate: (value: unknown) =>
        value == null || Number.isInteger(value) ? true : 'Used count must be a whole number.',
    },
    {
      name: 'validFrom',
      type: 'date',
      admin: { description: 'Code becomes active at this date/time (UTC). Leave blank for no start restriction.' },
    },
    {
      name: 'validUntil',
      type: 'date',
      admin: { description: 'Code expires after this date/time (UTC). Leave blank for no expiry.' },
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: { description: 'Uncheck to disable without deleting.' },
    },
  ],
}
