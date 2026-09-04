import type { CollectionConfig } from 'payload'
import { NAV_GROUPS } from './nav-groups'

/**
 * One product-import run.
 *
 * The job exists so the three phases in `docs/PRODUCT-IMPORT.md` stay separate:
 * discover writes `ImportItems` and fetches no image bytes, review is UI only,
 * and import touches `Products` for selected items alone. Nothing reaches the
 * catalog until a merchant presses import.
 *
 * MUST stay listed in `the tenant plugin({ collections: … })` in
 * `payload.config.ts` — `tenant-wiring.test.ts` enforces that, because the
 * access wrapper alone does not isolate tenants.
 */
export const ImportJobs: CollectionConfig = {
  slug: 'import-jobs',
  admin: {
    group: NAV_GROUPS['import-jobs'],
    useAsTitle: 'sourceUrl',
    defaultColumns: ['sourceUrl', 'sourceId', 'status', 'importedCount'],
    description: 'Product imports from an existing Shopify or WooCommerce store.',
  },
  // Per-store index; hosted prefixes `tenant` (TENANT_INDEXES in src/hosted/config.ts).
  indexes: [{ fields: ['status'] }],
  fields: [
    {
      name: 'sourceUrl',
      type: 'text',
      required: true,
      admin: { description: 'The storefront address the merchant pasted.' },
    },
    {
      name: 'sourceId',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Which adapter matched, as a registry id. Set by detection — the value is data, ' +
          'and nothing outside the adapter and the registry may branch on it.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'detecting',
      options: ['detecting', 'ready', 'importing', 'completed', 'failed', 'cancelled'],
      index: true,
    },

    // Counters. Kept on the job so the review screen and the tick endpoint can
    // report progress without aggregating over every item on each poll.
    { name: 'detectedProductCount', type: 'number', defaultValue: 0, min: 0 },
    { name: 'selectedCount', type: 'number', defaultValue: 0, min: 0 },
    { name: 'importedCount', type: 'number', defaultValue: 0, min: 0 },
    { name: 'failedCount', type: 'number', defaultValue: 0, min: 0 },

    {
      name: 'sourceCurrency',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'ISO 4217 as reported by the source. WooCommerce declares one; Shopify never does, ' +
          "in which case prices are read as the store's own currency.",
      },
    },

    {
      // The spec calls this `pricesIncludeTax` as a boolean. A boolean cannot
      // represent "the merchant has not answered yet", and the answer must not
      // have a default: guessing wrong makes every price in the catalog 5%
      // wrong, silently and permanently. A select with no default leaves it
      // null until someone actually chooses.
      name: 'priceTaxTreatment',
      type: 'select',
      options: [
        { label: 'Prices include tax', value: 'inclusive' },
        { label: 'Prices exclude tax', value: 'exclusive' },
      ],
      admin: {
        description:
          'How the source store priced its products. Required before import; deliberately has ' +
          'no default. Snapshotted onto each imported product so it can be reconciled when ' +
          'storefront tax is calculated.',
      },
    },

    // Not decoration: the record that a merchant claimed the right to import
    // this catalog is the thing you want to exist if it is ever disputed.
    { name: 'ownershipAttestedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'ownershipAttestedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true },
    },

    {
      name: 'error',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: 'Why the run failed, in the words the merchant should see.',
      },
    },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
