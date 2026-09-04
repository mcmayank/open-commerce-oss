import { describe, expect, it } from 'vitest'
import { buildOrderCreateData } from './orders-math'
import type { OrderData } from './orders'

/**
 * Guards the seam between `buildOrderFromCart` and the `payload.create` that
 * writes the order.
 *
 * That seam was a hand-written field list, and it omitted `taxRate`,
 * `taxInclusive` and `supplierTrn` — computed here, dropped by the caller.
 * `src/lib/invoicing/data.ts` derives `isTaxInvoice` from `supplierTrn` alone,
 * so every invoice this platform issued came out as a plain invoice: no
 * "Tax Invoice" heading, no TRN, no rate-labelled VAT row. The tax itself was
 * charged correctly; only the document was wrong, which is why nobody noticed.
 *
 * The fix is a spread, so the test that matters is the structural one: every
 * key of OrderData must survive. Adding a field to OrderData and forgetting the
 * caller must be impossible, not merely discouraged.
 */

const orderData = (over: Partial<OrderData> = {}): OrderData => ({
  orderNumber: 'ORD-A1B2C3XY',
  email: 'shopper@example.com',
  lineItems: [{ productId: 'p1', title: 'Loaf', unitPrice: 10000, qty: 1, lineTotal: 10000 }],
  subtotal: 10000,
  discountAmount: 0,
  shippingAmount: 0,
  taxAmount: 476,
  taxRate: 5,
  taxInclusive: true,
  supplierTrn: '100123456700003',
  total: 10000,
  currency: 'AED',
  shippingAddress: {
    line1: '1 Test Street',
    city: 'Dubai',
    postalCode: '00000',
    country: 'AE',
  } as OrderData['shippingAddress'],
  ...over,
})

describe('buildOrderCreateData', () => {
  it('forwards the tax snapshot, which the old hand-written list dropped', () => {
    const data = buildOrderCreateData(orderData(), { status: 'pending' })
    expect(data.taxRate).toBe(5)
    expect(data.taxInclusive).toBe(true)
    expect(data.supplierTrn).toBe('100123456700003')
  })

  it('forwards EVERY key of OrderData, so a new field cannot be silently dropped', () => {
    const source = orderData()
    const data = buildOrderCreateData(source, { status: 'pending' })
    for (const key of Object.keys(source) as (keyof OrderData)[]) {
      expect(data, `OrderData.${String(key)} did not reach the create payload`).toHaveProperty(key)
      expect(data[key], `OrderData.${String(key)} reached the payload with a different value`).toEqual(
        source[key],
      )
    }
  })

  it('lets the caller add fields OrderData does not carry', () => {
    const data = buildOrderCreateData(orderData(), {
      status: 'pending',
      paymentProvider: 'stripe',
      customer: 42,
    })
    expect(data.status).toBe('pending')
    expect(data.paymentProvider).toBe('stripe')
    expect(data.customer).toBe(42)
  })

  it('lets the caller override a computed field deliberately', () => {
    // `email` is on OrderData and the caller may also know it. Last write
    // wins, so an explicit extra is always the one that lands.
    const data = buildOrderCreateData(orderData({ email: 'a@example.com' }), { email: 'b@example.com' })
    expect(data.email).toBe('b@example.com')
  })

  it('carries a null tax snapshot through unchanged for a store with no VAT', () => {
    // Not registered: the fields are null, and null must arrive as null rather
    // than being dropped — `isTaxInvoice` reads absence and null identically,
    // but a dropped key would hide a later regression from the test above.
    const data = buildOrderCreateData(
      orderData({ taxAmount: 0, taxRate: null, taxInclusive: null, supplierTrn: null }),
      { status: 'pending' },
    )
    expect(data.taxRate).toBeNull()
    expect(data.taxInclusive).toBeNull()
    expect(data.supplierTrn).toBeNull()
  })
})
