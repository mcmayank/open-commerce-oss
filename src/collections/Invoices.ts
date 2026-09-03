import type { CollectionConfig } from 'payload'
import type { Access } from 'payload'
import { NAV_GROUPS } from './nav-groups'
import { storeIdOf } from '@/store-scope'

/**
 * Who may read a generated invoice PDF, including via `/api/invoices/file/**`.
 *
 * Invoices are never public. Anonymous readers are refused outright;
 * authenticated ones fall through to the same host-bound tenant constraint every
 * other tenant-scoped collection uses, so a merchant signed in to one store
 * cannot read another store's invoices.
 *
 * Delegating rather than returning `true` is the whole point. `the hosted tenant-scoping wrapper`
 * installs `read: hostBoundConstraint` as a DEFAULT that a collection's own
 * `access.read` REPLACES — so a bare boolean here would authenticate the reader
 * and then silently drop tenant scoping.
 */
/**
 * Core read rule: signed-in users only. The hosted overlay replaces this with
 * the host-bound tenant constraint (src/hosted/access/invoices-read.ts).
 */
export const invoicesReadAccess: Access = ({ req }) => Boolean(req.user)

/**
 * The per-document storage prefix: the tenant id, as a string.
 *
 * Composed with the collection prefix into `invoices/<tenantId>/<filename>`.
 * Returns null when the tenant cannot be determined so the write fails loudly
 * instead of filing one store's invoice under a path that may belong to another.
 */
export const setInvoicePrefix = (data: { tenant?: unknown }): string | null => {
  const id = storeIdOf(data)
  return id === undefined ? null : String(id)
}

/**
 * Generated invoice PDFs, written by `issueInvoice`. Deliberately NOT in `media`:
 * that collection is public-read for storefront images, accepts image types, and
 * meters uploads against the merchant's storage quota. An invoice wants the
 * opposite of all three.
 *
 * No storage-quota hooks by design — an invoice is Niblr's output, not the
 * merchant's upload, and `mediaBytesUsed` is about to become a commercial gate.
 */
export const Invoices: CollectionConfig = {
  slug: 'invoices',
  admin: {
    group: NAV_GROUPS.invoices,
    useAsTitle: 'invoiceNumber',
    defaultColumns: ['invoiceNumber', 'createdAt'],
  },
  access: { read: invoicesReadAccess },
  fields: [
    {
      name: 'invoiceNumber',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: 'Allocated by issueInvoice. Also stored on the order.' },
    },
    {
      name: 'prefix',
      type: 'text',
      admin: { hidden: true },
    },
  ],
  upload: { mimeTypes: ['application/pdf'] },
  hooks: {
    beforeChange: [
      ({ data }) => {
        const prefix = setInvoicePrefix(data as { tenant?: unknown })
        if (prefix === null) {
          throw new Error('invoices: cannot store a PDF without a resolved tenant')
        }
        return { ...data, prefix }
      },
    ],
  },
}
