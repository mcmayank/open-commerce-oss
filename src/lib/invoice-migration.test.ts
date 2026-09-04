import { describe, expect, it } from 'vitest'
import {
  EXPECTED_DROP_IDS,
  migrationEnvironmentError,
  migrationShapeError,
  planInvoiceMigration,
  type InvoicePdfRow,
} from './invoice-migration'

/**
 * This script deletes objects from a bucket that local .env also points at, so
 * the decision of what to touch is separated from the doing and tested on its own.
 */

/**
 * The real production rows, read from the database on 26 Jul 2026. Note row 95:
 * the order says INV-00001 while the file says INV-2. That disagreement is the
 * whole reason the invoice number comes from the order.
 */
const rows: InvoicePdfRow[] = [
  {
    id: 14,
    filename: 'invoice-INV-00001.pdf',
    filesize: 2775,
    tenantId: 2,
    tenantSlug: 'store-a',
    orderId: 1,
    orderInvoiceNumber: 'INV-00001',
  },
  {
    id: 15,
    filename: 'invoice-INV-00002.pdf',
    filesize: 2787,
    tenantId: 2,
    tenantSlug: 'store-a',
    orderId: 2,
    orderInvoiceNumber: 'INV-00002',
  },
  {
    id: 95,
    filename: 'invoice-INV-2.pdf',
    filesize: 3168,
    tenantId: 6,
    tenantSlug: 'sdbakery',
    orderId: 3,
    orderInvoiceNumber: 'INV-00001',
  },
]

describe('planInvoiceMigration', () => {
  it('migrates rows belonging to a kept tenant', () => {
    const plan = planInvoiceMigration(rows, ['sdbakery'])
    expect(plan.migrate).toEqual([
      {
        id: 95,
        filename: 'invoice-INV-2.pdf',
        filesize: 3168,
        tenantId: 6,
        tenantSlug: 'sdbakery',
        orderId: 3,
        orderInvoiceNumber: 'INV-00001',
        sourceKey: 'invoice-INV-2.pdf',
        destKey: 'invoices/6/invoice-INV-2.pdf',
        invoiceNumber: 'INV-00001',
      },
    ])
  })

  it('takes the invoice number from the order, not the filename', () => {
    // The relink UPDATE joins invoices.invoice_number = orders.invoice_number.
    // Production order 3 says INV-00001 but its file is invoice-INV-2.pdf, so a
    // filename-derived number matches zero rows: the media row and its object are
    // deleted, an orphaned invoices doc is created, and the order loses its PDF.
    const plan = planInvoiceMigration(rows, ['sdbakery'])
    expect(plan.migrate[0].invoiceNumber).toBe('INV-00001')
    expect(plan.migrate[0].invoiceNumber).not.toBe('INV-2')
  })

  it('drops rows belonging to every other tenant', () => {
    const plan = planInvoiceMigration(rows, ['sdbakery'])
    expect(plan.drop.map((r) => r.id)).toEqual([14, 15])
  })

  it('accounts for every input row exactly once', () => {
    // A row silently falling through would leave a PDF in media and keep
    // MEDIA-PIPELINE Task 1 blocked.
    const plan = planInvoiceMigration(rows, ['sdbakery'])
    expect(plan.migrate.length + plan.drop.length).toBe(rows.length)
  })

  it('migrates nothing when no tenant is kept', () => {
    const plan = planInvoiceMigration(rows, [])
    expect(plan.migrate).toEqual([])
    expect(plan.drop).toHaveLength(3)
  })
})

describe('migrationShapeError', () => {
  it('accepts the reviewed production shape', () => {
    const plan = planInvoiceMigration(rows, ['sdbakery'])
    expect(migrationShapeError({ pdfRowCount: rows.length, plan })).toBeNull()
  })

  it('refuses to delete a media row outside the reviewed set', () => {
    // A store that issues its first invoice between the deploy and this script
    // running would otherwise be deleted by default, for not being sdbakery.
    const newcomer: InvoicePdfRow = {
      id: 120,
      filename: 'invoice-INV-00001.pdf',
      filesize: 3000,
      tenantId: 9,
      tenantSlug: 'brand-new-store',
      orderId: 40,
      orderInvoiceNumber: 'INV-00001',
    }
    const withNewcomer = [...rows, newcomer]
    const plan = planInvoiceMigration(withNewcomer, ['sdbakery'])
    // Count deliberately held at the expected 3 so the id check is what fires.
    const err = migrationShapeError({ pdfRowCount: 3, plan })
    expect(err).toMatch(/120/)
    expect(err).toMatch(/brand-new-store/)
    expect(err).toMatch(/re-verify/i)
  })

  it('refuses when the number of PDF rows has changed', () => {
    const plan = planInvoiceMigration(rows, ['sdbakery'])
    const err = migrationShapeError({ pdfRowCount: 4, plan })
    expect(err).toMatch(/found 4/)
    expect(err).toMatch(/re-verify/i)
  })

  it('pins the reviewed drop set to the two store-a rows', () => {
    expect(EXPECTED_DROP_IDS).toEqual([14, 15])
  })
})

describe('migrationEnvironmentError', () => {
  const PROD = 'niblrstore'

  it('refuses a local database paired with the production bucket', () => {
    // The dangerous combination: reads local rows, deletes PRODUCTION objects.
    const err = migrationEnvironmentError({
      databaseUrl: 'postgres://user@localhost:5432/open_commerce_local',
      bucket: PROD,
    })
    expect(err).toMatch(/local/i)
    expect(err).toMatch(/production/i)
  })

  it('also catches 127.0.0.1', () => {
    expect(
      migrationEnvironmentError({ databaseUrl: 'postgres://u@127.0.0.1:5432/db', bucket: PROD }),
    ).not.toBeNull()
  })

  it('allows a production database with the production bucket', () => {
    expect(
      migrationEnvironmentError({
        databaseUrl: 'postgres://u@db.ciqsazvrwzsojtkwxnyt.supabase.co:6543/postgres',
        bucket: PROD,
      }),
    ).toBeNull()
  })

  it('allows a local database with a non-production bucket', () => {
    expect(
      migrationEnvironmentError({ databaseUrl: 'postgres://u@localhost:5432/db', bucket: 'scratch' }),
    ).toBeNull()
  })
})
