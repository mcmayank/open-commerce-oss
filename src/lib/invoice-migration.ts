export { migrationEnvironmentError, PRODUCTION_BUCKET } from '@/lib/migration-guard'

/**
 * Decides what the invoice migration does, separated from doing it.
 *
 * The runner deletes objects from an R2 bucket that local `.env` also points at,
 * so the "which rows" question is pure, tested, and reviewable on its own.
 */

export interface InvoicePdfRow {
  id: number
  filename: string
  filesize: number
  tenantId: number
  tenantSlug: string
  /** id of the order whose `invoicePdf` points at this media row. */
  orderId: number
  /**
   * The invoice number stored ON THE ORDER, which is the record.
   *
   * NOT parsed from the filename. In production these disagree: order 3
   * (sdbakery) carries `INV-00001` while its file is `invoice-INV-2.pdf`. The
   * relink UPDATE joins `invoices.invoice_number = orders.invoice_number`, so a
   * filename-derived number would match zero rows, delete the media row and its
   * object, and leave the order with no PDF — silently.
   */
  orderInvoiceNumber: string
}

export interface InvoiceMigrationItem extends InvoicePdfRow {
  /** Current object key: a bare filename, since `media` runs with no prefix. */
  sourceKey: string
  /** New key under the tenant-prefixed `invoices` collection. */
  destKey: string
  /** Copied from the linked order; used to relink the order in Task 4. */
  invoiceNumber: string
}

export interface InvoiceMigrationPlan {
  migrate: InvoiceMigrationItem[]
  drop: InvoicePdfRow[]
}

export function planInvoiceMigration(
  rows: InvoicePdfRow[],
  keepTenantSlugs: string[],
): InvoiceMigrationPlan {
  const keep = new Set(keepTenantSlugs)
  const migrate: InvoiceMigrationItem[] = []
  const drop: InvoicePdfRow[] = []

  for (const row of rows) {
    if (keep.has(row.tenantSlug)) {
      migrate.push({
        ...row,
        sourceKey: row.filename,
        destKey: `invoices/${row.tenantId}/${row.filename}`,
        invoiceNumber: row.orderInvoiceNumber,
      })
    } else {
      drop.push(row)
    }
  }

  return { migrate, drop }
}

/**
 * The production shape this migration was written against, verified directly
 * against the database on 26 Jul 2026:
 *
 *   id 14  store-a   invoice-INV-00001.pdf   (order 1, INV-00001)
 *   id 15  store-a   invoice-INV-00002.pdf   (order 2, INV-00002)
 *   id 95  sdbakery  invoice-INV-2.pdf       (order 3, INV-00001)
 */
export const EXPECTED_PDF_ROW_COUNT = 3
export const EXPECTED_DROP_IDS = [14, 15]

/**
 * Refuses to apply against data that is not the shape this script was reviewed
 * for. Deleting is the DEFAULT action for any tenant outside KEEP_TENANT_SLUGS,
 * and the script runs after the deploy — so a store that issues its first
 * invoice in that window would have it permanently deleted by a script nobody
 * re-read. The expectation is deliberately hardcoded so widening it is an edit
 * a human makes on purpose.
 *
 * Returns null when the data matches, or the message to print and exit on.
 */
export function migrationShapeError(args: {
  /** Every PDF row found in `media`, including any the plan skipped. */
  pdfRowCount: number
  plan: InvoiceMigrationPlan
}): string | null {
  const reverify =
    `Re-verify the production data and update EXPECTED_PDF_ROW_COUNT / ` +
    `EXPECTED_DROP_IDS in src/lib/invoice-migration.ts deliberately before re-running.`

  if (args.pdfRowCount !== EXPECTED_PDF_ROW_COUNT) {
    return (
      `Refusing to apply: expected ${EXPECTED_PDF_ROW_COUNT} PDF rows in media, ` +
      `found ${args.pdfRowCount}. The data has changed since this script was reviewed. ` +
      reverify
    )
  }

  const unexpected = args.plan.drop.filter((row) => !EXPECTED_DROP_IDS.includes(row.id))
  if (unexpected.length > 0) {
    const listed = unexpected.map((r) => `${r.id} (${r.filename}, ${r.tenantSlug})`).join(', ')
    return (
      `Refusing to apply: would DELETE media rows outside the reviewed set ` +
      `[${EXPECTED_DROP_IDS.join(', ')}]: ${listed}. These invoices would be lost. ` +
      reverify
    )
  }

  return null
}

