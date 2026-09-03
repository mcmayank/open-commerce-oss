import type { Order, StoreSetting } from '@/payload-types'
import { formatMoney } from '@/lib/money'
import { taxableBaseOf } from '@/lib/orders-math'

export interface InvoiceLine {
  title: string
  variantTitle?: string | null
  qty: number
  unitPrice: string
  lineTotal: string
}

export interface InvoiceData {
  invoiceNumber: string
  issuedAt: string
  storeName: string
  logoUrl?: string | null
  orderNumber: string
  status: string
  currency: string
  billTo: {
    email: string
    name?: string | null
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  }
  lines: InvoiceLine[]
  subtotal: string
  discount?: string | null
  shipping?: string | null
  tax?: string | null
  total: string
  /**
   * True only when the order carried a supplier TRN. A UAE simplified tax
   * invoice needs the words "Tax Invoice", the supplier's TRN and the VAT
   * amount — printing the heading without the TRN is itself non-compliant, so
   * the TRN is what promotes the document.
   */
  isTaxInvoice: boolean
  /** The store's TRN as it stood when the order was placed. */
  supplierTrn?: string | null
  /** e.g. "VAT (5%)" — null when no VAT applies. */
  taxLabel?: string | null
  /**
   * The net amount, shown only for inclusive pricing where the total does not
   * move and the arithmetic would otherwise be invisible. Null for exclusive,
   * where the subtotal already IS the net.
   */
  taxableAmount?: string | null
}

const money = (minor: number | null | undefined, currency: string): string =>
  formatMoney(minor ?? 0, currency)

const nonZero = (minor: number | null | undefined, currency: string): string | null =>
  minor && minor > 0 ? formatMoney(minor, currency) : null

/** Pure: turn an order + its store settings into the render-ready invoice data. */
export function buildInvoiceData(
  order: Order,
  settings: StoreSetting | null,
  invoiceNumber: string,
  issuedAt: Date,
): InvoiceData {
  const currency = order.currency ?? 'USD'
  const addr = order.shippingAddress ?? ({} as NonNullable<Order['shippingAddress']>)
  const logo = settings?.logo
  const logoUrl = logo && typeof logo === 'object' ? (logo.url ?? null) : null

  // Read from the ORDER, never from live settings — the order carries the tax
  // context in force when it was placed, so changing the rate later cannot
  // restate an invoice that has already gone out.
  const trn = String(order.supplierTrn ?? '').trim() || null
  const isTaxInvoice = trn !== null

  return {
    invoiceNumber,
    issuedAt: issuedAt.toISOString(),
    storeName: settings?.storeName ?? 'Store',
    logoUrl,
    orderNumber: order.orderNumber ?? '',
    status: order.status,
    currency,
    billTo: {
      email: order.email,
      name: addr.name,
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
    },
    lines: (order.lineItems ?? []).map((li) => ({
      title: li.title,
      variantTitle: li.variantTitle,
      qty: li.qty,
      unitPrice: money(li.unitPrice, currency),
      lineTotal: money(li.lineTotal, currency),
    })),
    subtotal: money(order.subtotal, currency),
    discount: nonZero(order.discountAmount, currency),
    shipping: nonZero(order.shippingAmount, currency),
    // NOT nonZero(). Two changes from it:
    //  - a registered merchant's ZERO-rated order shows 0.00 instead of the row
    //    vanishing, which is what a zero-rated supply must look like;
    //  - any non-zero tax is shown even without a TRN, because money the
    //    customer actually paid must never be omitted from their invoice.
    // Only the genuinely untaxed, unregistered case hides the row.
    tax:
      isTaxInvoice || (order.taxAmount ?? 0) > 0 ? money(order.taxAmount, currency) : null,
    total: money(order.total, currency),
    isTaxInvoice,
    supplierTrn: trn,
    taxLabel: isTaxInvoice ? `VAT (${order.taxRate ?? 0}%)` : null,
    // Inclusive only: the shopper paid the gross, so showing the net is what
    // makes the VAT line add up on the page.
    //
    // The gross MUST come from `taxableBaseOf`, not from `order.subtotal`.
    // `taxAmount` was charged on a base that excludes gift-card lines — selling
    // a card is taking a deposit, not making a taxable supply — so pairing it
    // with the full subtotal prints two numbers that cannot both be true. On
    // AED 100 of goods plus an AED 200 card at 5% inclusive, that read
    // "Taxable amount AED 295.24" directly above "VAT (5%) AED 4.76", an
    // implied rate of about 1.6%. Niblr issues this document under the
    // merchant's name, so an invoice that does not reconcile is Niblr's output.
    taxableAmount:
      isTaxInvoice && order.taxInclusive
        ? money(
            taxableBaseOf(
              order.lineItems ?? [],
              order.discountAmount ?? 0,
              order.shippingAmount ?? 0,
            ) - (order.taxAmount ?? 0),
            currency,
          )
        : null,
  }
}
