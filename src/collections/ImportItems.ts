import type { CollectionConfig } from 'payload'
import { IMPORT_WARNINGS } from '@/imports/core/types'

/**
 * One product found during discovery, and what became of it.
 *
 * `mapped` is stored so review never has to re-fetch the source and import never
 * has to re-map: discovery is the only phase that talks to the merchant's old
 * store. That separation keeps review at zero network calls and keeps image
 * bytes out of discovery entirely.
 *
 * Rows are DELETED once their job completes — see the tick route. The mapped
 * payload is ~10 KB per product and has served its purpose the moment the
 * product exists; provenance lives on `Products.importedFrom` instead. Keeping
 * it would put ~10 MB per import in Postgres forever.
 *
 * MUST stay listed in `the tenant plugin({ collections: … })` — see
 * `tenant-wiring.test.ts`.
 */
export const ImportItems: CollectionConfig = {
  slug: 'import-items',
  admin: {
    group: 'Store',
    useAsTitle: 'externalId',
    defaultColumns: ['externalId', 'status', 'job'],
    // Machinery behind the review screen, not something to browse by hand.
    hidden: true,
  },
  indexes: [
    // The claim query in the tick endpoint: pending items for one job.
    { fields: ['job', 'status'] },
    // One row per source product per job, so a re-run of discovery cannot
    // double-insert.
    { fields: ['job', 'externalId'], unique: true },
  ],
  fields: [
    { name: 'job', type: 'relationship', relationTo: 'import-jobs', required: true, index: true },
    {
      name: 'externalId',
      type: 'text',
      required: true,
      admin: { description: "The product's stable id on the source platform." },
    },
    {
      name: 'mapped',
      type: 'json',
      admin: {
        description:
          'The normalised SourceProduct the import phase will write. There was a `raw` ' +
          'field beside this holding "the source payload as received" — it was a ' +
          'byte-identical copy of this one, because adapters only ever return the mapped ' +
          'product. It doubled the database cost of every import and was removed 4 Aug 2026. ' +
          'Storing the true source payload would mean an adapter actually returning it.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'selected', 'skipped', 'imported', 'failed'],
      index: true,
    },
    {
      name: 'warnings',
      type: 'select',
      hasMany: true,
      // Derived from the ImportWarning union so a new code cannot be raised by
      // an adapter without becoming storable here.
      options: [...IMPORT_WARNINGS],
      admin: { description: 'Stable codes the review grid renders as chips.' },
    },
    {
      name: 'claimedAt',
      type: 'date',
      index: true,
      admin: {
        readOnly: true,
        description:
          'Set when a tick takes this item. Two concurrent ticks cannot claim the same row, ' +
          'so a merchant refreshing the import screen cannot double-create a product.',
      },
    },
    { name: 'error', type: 'textarea', admin: { readOnly: true } },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      admin: { readOnly: true, description: 'Set once this item has been imported.' },
    },
  ],
}
