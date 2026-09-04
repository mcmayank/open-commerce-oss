import type { Order } from '@/payload-types'
import type { Payload } from 'payload'
import { allocateInvoiceNumber } from './number'
import { buildInvoiceData } from './data'
import { renderInvoicePdf } from './pdf'
import { sendInvoice } from '@/lib/email'
import { storeWhere, storeRef, storeIdOf } from '@/store-scope'

export interface IssueInvoiceDeps {
  allocate: typeof allocateInvoiceNumber
  buildData: typeof buildInvoiceData
  renderPdf: typeof renderInvoicePdf
  send: typeof sendInvoice
}

const defaultDeps: IssueInvoiceDeps = {
  allocate: allocateInvoiceNumber,
  buildData: buildInvoiceData,
  renderPdf: renderInvoicePdf,
  send: sendInvoice,
}

const tenantIdOf = (order: Order): string | number => storeIdOf(order) as string | number

/**
 * Generate + store + email an invoice for an order.
 *
 * Idempotent: returns early (unchanged order) if already invoiced unless `force` is set.
 * `force` reuses the existing invoice number and re-sends without allocating a new one.
 * First issue allocates a new invoice number.
 *
 * `invoiceIssuedAt` is stamped only on first issue; `invoiceSentAt` is updated every time.
 */
export async function issueInvoice(
  payload: Payload,
  order: Order,
  opts: { force?: boolean } = {},
  deps: IssueInvoiceDeps = defaultDeps,
): Promise<Order> {
  // Idempotency guard: already invoiced and not forcing → return unchanged
  if (order.invoiceNumber && !opts.force) return order

  const tenantId = tenantIdOf(order)

  // Fetch store settings for PDF rendering (store name, logo, etc.)
  const { docs } = await payload.find({
    collection: 'store-settings',
    where: storeWhere(tenantId),
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const settings = docs[0] ?? null

  // Allocate a new number on first issue; reuse existing on force re-send
  const invoiceNumber = order.invoiceNumber ?? (await deps.allocate(payload, tenantId))

  const now = new Date()
  const data = deps.buildData(order, settings, invoiceNumber, now)
  const pdf = await deps.renderPdf(data)

  // Store the PDF in the `invoices` collection — private, PDF-only, and not
  // metered against the merchant's storage quota. `tenant` is normally injected
  // by the tenant-scoped plugin hook from request context, but this runs under
  // overrideAccess with no request, so it is passed explicitly.
  const invoice = await payload.create({
    collection: 'invoices',
    data: { invoiceNumber, ...storeRef(Number(tenantId)) },
    file: { data: pdf, name: `invoice-${invoiceNumber}.pdf`, mimetype: 'application/pdf', size: pdf.length },
    overrideAccess: true,
  })

  const nowIso = now.toISOString()
  // 1. Persist the invoice record BEFORE sending, so a send failure is recoverable
  //    (the order keeps its invoiceNumber, so a { force: true } retry re-sends without allocating a new number).
  await payload.update({
    collection: 'orders',
    id: order.id,
    overrideAccess: true,
    data: {
      invoiceNumber,
      invoicePdf: invoice.id,
      // invoiceIssuedAt: first-issue only; force re-sends preserve the original stamp
      invoiceIssuedAt: order.invoiceIssuedAt ?? nowIso,
    },
  })

  // 2. Send (propagates on failure — caller decides). invoiceSentAt is stamped only AFTER a successful send,
  //    so the record never claims "sent" when it wasn't.
  await deps.send({ ...order, invoiceNumber }, pdf, data.storeName)

  return (await payload.update({
    collection: 'orders',
    id: order.id,
    overrideAccess: true,
    data: { invoiceSentAt: nowIso },
  })) as Order
}
