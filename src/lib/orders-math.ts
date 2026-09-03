/**
 * Pure, dependency-free order math functions.
 * These can be tested in vitest without Payload / Next.js.
 */

export type OrderLineItem = {
  productId: string
  title: string
  variantTitle?: string
  unitPrice: number
  qty: number
  lineTotal: number
  /**
   * Set when the product carries `issuesGiftCard`. Excluded from the taxable
   * base: selling a gift card is taking a deposit, not making a taxable supply.
   * Still counted in `subtotal` and `total` — the customer pays for it.
   */
  isGiftCard?: boolean
}

/**
 * The base a discount code is calculated against: every line EXCEPT gift cards.
 *
 * Two separate reasons, either one sufficient:
 *
 *  1. TAX. `taxableBaseOf` below subtracts the WHOLE `discountAmount` from a
 *     base that already excludes gift-card lines. A discount computed over the
 *     full subtotal can therefore exceed that base and wipe out real tax: at 5%
 *     exclusive, goods 10000 + a 90000 gift card with a 20%-off code gives a
 *     discount of 20000, a taxable base of max(0, 10000 − 20000) = 0, and zero
 *     VAT charged on a genuinely taxable 10000 supply — on an invoice Niblr
 *     issues under the merchant's name. Apportioning the discount across the
 *     two kinds of line would also fix the arithmetic, but not reason 2.
 *  2. MONEY. A percentage code applied to a gift card sells stored value at a
 *     discount: buy a 100 card for 80, spend 100. That is a leak the merchant
 *     never intended when they set up a "20% off" code, and it is not fixed by
 *     any amount of careful tax maths.
 *
 * Passed to `applyDiscount` as its `subtotalMinor`, which also caps the
 * discount at this base — so a fixed-amount code can never reach into the
 * gift-card money either. The `minOrder` threshold is measured against the same
 * base for the same reason: if a gift card cannot be discounted, buying one
 * should not be what qualifies a cart for the discount.
 */
export function discountableBaseOf(lineItems: OrderLineItem[]): number {
  return lineItems.filter((l) => !l.isGiftCard).reduce((sum, l) => sum + l.lineTotal, 0)
}

/**
 * The base VAT is charged on: every line EXCEPT gift cards, less discount, plus
 * shipping.
 *
 * Gift-card lines are excluded because selling a gift card is taking a deposit,
 * not making a taxable supply — the VAT is charged later, on the goods the card
 * buys. Taxing it here would tax the same money twice.
 *
 * Exported and pure specifically so a test can import it. An earlier version of
 * this rule lived inline in `buildOrderFromCart` with the test mirroring it, so
 * reverting the production line left the test green — the guard proved the rule
 * and nothing about the code.
 *
 * It takes only the two fields it actually reads, so every caller can pass its
 * own line shape: the cart summary's lighter line, the checkout summary's, and
 * a stored `Order['lineItems']` straight off Payload. That matters for the same
 * reason: the cart, the checkout summary and the invoice must all show the tax
 * the order really charged, and the only way to guarantee that is for all of
 * them to run THIS function rather than four copies of the rule.
 *
 * `isGiftCard` admits `null` because that is what Payload stores for a row
 * written before the column existed. Falsy is falsy — an unset flag means a
 * normal, taxable line.
 */
export function taxableBaseOf(
  lineItems: ReadonlyArray<{ lineTotal: number; isGiftCard?: boolean | null }>,
  discountAmount: number,
  shippingAmount: number,
): number {
  const taxable = lineItems
    .filter((l) => !l.isGiftCard)
    .reduce((sum, l) => sum + l.lineTotal, 0)
  return Math.max(0, taxable - discountAmount + shippingAmount)
}

/**
 * Compute order totals from enriched line items.
 * All amounts are integer minor units (paise / cents).
 *
 *   subtotal = Σ lineTotal
 *   total    = max(0, subtotal − discountAmount + shippingAmount + taxAmount)
 */
export function computeOrderAmounts(
  lineItems: OrderLineItem[],
  discountAmount: number,
  shippingAmount: number,
  taxAmount: number,
): { subtotal: number; total: number } {
  const subtotal = lineItems.reduce((sum, l) => sum + l.lineTotal, 0)
  const total = Math.max(0, subtotal - discountAmount + shippingAmount + taxAmount)
  return { subtotal, total }
}

/** Order statuses that reverse a sale — excluded from revenue even if paidAt is set. */
const REVERSED_STATUSES = new Set(['cancelled', 'refunded'])

/**
 * Sums paid orders and counts them. An order counts as revenue once it has been
 * paid — i.e. `paidAt` is set — and stays counted through fulfillment
 * (paid → shipped → delivered all retain `paidAt`). Never-paid orders (pending)
 * and reversed orders (cancelled/refunded) are excluded.
 *
 * A PARTIAL refund is netted off rather than reversing the sale. The order is
 * still a sale; it simply brought in less than it charged, and it keeps its
 * fulfilment status. Only a full refund flips the status to `refunded`, which
 * drops it here entirely — which is exactly why `decideRefund` refuses to set
 * that status until nothing remains.
 */
export function summarizeOrders(
  orders: {
    paidAt: string | null
    status: string | null
    total: number | null
    refundedAmount?: number | null
  }[],
): { count: number; revenueMinor: number } {
  return orders.reduce(
    (acc, order) => {
      if (order.paidAt && !REVERSED_STATUSES.has(order.status ?? '')) {
        acc.count += 1
        const net = (order.total ?? 0) - (order.refundedAmount ?? 0)
        acc.revenueMinor += Math.max(0, net)
      }
      return acc
    },
    { count: 0, revenueMinor: 0 },
  )
}

/**
 * The payload for creating an order row: everything `buildOrderFromCart`
 * computed, plus the few things only the caller knows.
 *
 * It SPREADS the computed data rather than restating its fields, and that is the
 * whole point. `startCheckout` used to hand-list them and quietly omitted
 * `taxRate`, `taxInclusive` and `supplierTrn` — three fields `buildOrderFromCart`
 * had been computing and handing over all along. `src/lib/invoicing/data.ts`
 * derives `isTaxInvoice` from `supplierTrn` alone, so with it always null EVERY
 * invoice this platform issued rendered as a plain invoice: no "Tax Invoice"
 * heading, no TRN, no rate-labelled VAT row. For a VAT-registered merchant those
 * are the three things that make the document compliant, and the failure was
 * silent — the tax was charged correctly and only the paperwork was wrong.
 *
 * Lives here rather than in `orders.ts` so it can be unit-tested: `orders.ts`
 * pulls in the Payload config, this module is pure.
 *
 * `const E` is load-bearing: without it the generic widens a literal like
 * `status: 'pending'` to `string`, which Payload's `data` union rejects. The
 * old inline object literal got that narrowing from contextual typing for free.
 *
 * Do not convert this back to a field list.
 */
export function buildOrderCreateData<
  D extends Record<string, unknown>,
  const E extends Record<string, unknown>,
>(orderData: D, extras: E): D & E {
  return { ...orderData, ...extras }
}
