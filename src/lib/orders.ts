import config from '@payload-config'
import { getPayload } from 'payload'
import { getProductsByIds } from './storefront'
import { applyDiscount } from './discount'
import { computeOrderAmounts, discountableBaseOf, taxableBaseOf } from './orders-math'
import { orderTax, type TaxConfig } from './tax'
import type { Cart } from './cart'
import { storeWhere, storeRef } from '@/store-scope'

// Re-export so callers can import everything from one place
export { computeOrderAmounts } from './orders-math'
export type { OrderLineItem } from './orders-math'

export type ShippingAddress = {
  name: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
  phone?: string
}

export type OrderData = {
  orderNumber: string
  email: string
  lineItems: import('./orders-math').OrderLineItem[]
  subtotal: number
  discountCode?: string
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  /** Snapshotted tax context — see `orderTax`. Null when no VAT applies. */
  taxRate?: number | null
  taxInclusive?: boolean | null
  supplierTrn?: string | null
  total: number
  currency: string
  shippingAddress: ShippingAddress
}

export type BuildOrderResult =
  | { ok: true; data: OrderData }
  | { ok: false; error: string }

/** Generate a random order number like ORD-A1B2C3XY */
function generateOrderNumber(): string {
  // Omit 0/O/I/1 to reduce visual confusion.
  // 8 chars from a 32-symbol alphabet → 32^8 ≈ 1.1T combinations per tenant;
  // collision odds are negligible. The DB UNIQUE index on (tenant, orderNumber)
  // is the primary safety net.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `ORD-${suffix}`
}

/**
 * Build order data from a cart, tenant, and customer input.
 *
 * Security invariants:
 *  - Prices are re-fetched from the database (`getProductsByIds`) — never read
 *    from the cart cookie or form data.
 *  - Products are filtered to the given tenant and must be `active`.
 *  - Discount codes are looked up in `discount-codes` scoped to the tenant.
 *
 * Tax comes from the store's settings via `opts.tax` and is SNAPSHOTTED onto
 * the order (rate, inclusive flag, TRN), so changing the rate later never
 * restates an invoice that has already been issued.
 */
export async function buildOrderFromCart(
  tenantId: number | string,
  cart: Cart,
  opts: {
    email: string
    shippingAddress: ShippingAddress
    discountCode?: string
    currency: string
    /** Flat shipping/delivery fee in minor units (e.g. zone delivery fee). */
    shippingAmount?: number
    /**
     * The store's tax settings, read by the caller from StoreSettings. Passed in
     * rather than fetched here so the tax decision stays testable, and so the
     * values that land on the order are the ones in force at checkout.
     */
    tax?: TaxConfig | null
  },
): Promise<BuildOrderResult> {
  // 1. Fetch current prices for all cart product IDs — tenant-scoped + active-only
  const productIds = [...new Set(cart.map((l) => l.productId))]
  const products = await getProductsByIds(tenantId, productIds)
  const productMap = new Map(products.map((p) => [String(p.id), p]))

  // 2. Build line-item snapshots at current server-side prices (variant-aware)
  const lineItems: import('./orders-math').OrderLineItem[] = []
  for (const line of cart) {
    const product = productMap.get(line.productId)
    if (!product) continue // removed / inactive — drop silently (self-healing)

    let unitPrice: number
    let variantTitle: string | undefined

    if (line.variantId) {
      const variant = (product.variants ?? []).find((v) => v.id === line.variantId)
      if (!variant) continue // variant removed — drop
      unitPrice = Math.round(variant.price)
      variantTitle = variant.title ?? undefined
    } else {
      unitPrice = Math.round(product.price)
    }

    // Defense-in-depth: parseCart already floors/validates qty, but guard here
    // ensures the money calculation never operates on fractional or zero qty.
    if (!Number.isInteger(line.qty) || line.qty <= 0) continue

    const lineTotal = unitPrice * line.qty
    const item: import('./orders-math').OrderLineItem = {
      productId: String(product.id),
      title: product.title,
      unitPrice,
      qty: line.qty,
      lineTotal,
    }
    if (variantTitle) item.variantTitle = variantTitle
    if (product.issuesGiftCard) item.isGiftCard = true
    lineItems.push(item)
  }

  if (lineItems.length === 0) {
    return { ok: false, error: 'Your cart is empty or all products are unavailable.' }
  }

  // 3. Validate and apply discount code if provided
  let discountAmount = 0
  let discountCodeStr: string | undefined

  if (opts.discountCode?.trim()) {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'discount-codes',
      where: {
        and: [
          storeWhere(tenantId),
          { code: { equals: opts.discountCode.trim().toUpperCase() } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (!docs[0]) {
      return { ok: false, error: 'Discount code not found.' }
    }

    // Gift-card lines are NOT discountable — see `discountableBaseOf` in
    // `orders-math.ts` for both reasons (it understates VAT on a mixed cart,
    // and it sells stored value below face). This is also what keeps
    // `discountAmount` within the taxable base a few lines down.
    const subtotalForDiscount = discountableBaseOf(lineItems)
    const result = applyDiscount(subtotalForDiscount, docs[0])
    if (result.error) {
      return { ok: false, error: result.error }
    }
    discountAmount = result.discountAmount
    discountCodeStr = opts.discountCode.trim().toUpperCase()
  }

  // 4. Shipping: caller-supplied flat fee (e.g. delivery-zone fee), validated
  //    to the integer minor-units invariant.
  const shippingAmount =
    Number.isInteger(opts.shippingAmount) && (opts.shippingAmount as number) >= 0
      ? (opts.shippingAmount as number)
      : 0

  // 5. Tax on subtotal − discount + shipping.
  //
  //    `taxToAdd` is NOT `taxAmount`. In inclusive mode the VAT already sits
  //    inside the line prices, so it is recorded on the order but must not be
  //    added to the total again — passing `taxAmount` here would overcharge
  //    every inclusive-priced order.
  // Gift-card lines are excluded from the taxable base — see `taxableBaseOf`
  // in `orders-math.ts` for why, and `src/lib/orders.giftcard-tax.test.ts`
  // for the guard.
  const taxableBase = taxableBaseOf(lineItems, discountAmount, shippingAmount)
  const tax = orderTax(taxableBase, opts.tax)

  const { subtotal, total } = computeOrderAmounts(
    lineItems,
    discountAmount,
    shippingAmount,
    tax.taxToAdd,
  )

  const orderData: OrderData = {
    ...storeRef(tenantId),
    orderNumber: generateOrderNumber(),
    email: opts.email,
    lineItems,
    subtotal,
    discountAmount,
    shippingAmount,
    taxAmount: tax.taxAmount,
    taxRate: tax.taxRate,
    taxInclusive: tax.taxInclusive,
    supplierTrn: tax.supplierTrn,
    total,
    currency: opts.currency,
    shippingAddress: opts.shippingAddress,
  }
  if (discountCodeStr) orderData.discountCode = discountCodeStr

  return { ok: true, data: orderData }
}
