import { describe, expect, it } from 'vitest'
import { buildInvoiceData } from './data'

const order = {
  orderNumber: 'ORD-00007',
  status: 'paid',
  email: 'buyer@example.com',
  currency: 'USD',
  subtotal: 5000,
  discountAmount: 500,
  shippingAmount: 300,
  taxAmount: 360,
  total: 5160,
  lineItems: [
    { title: 'Widget', variantTitle: 'Blue', qty: 2, unitPrice: 2000, lineTotal: 4000 },
    { title: 'Gadget', qty: 1, unitPrice: 1000, lineTotal: 1000 },
  ],
  shippingAddress: { name: 'Jane', line1: '1 Main', city: 'Metropolis', postalCode: '00001', country: 'US' },
} as never

const settings = { storeName: 'Acme' } as never

describe('buildInvoiceData', () => {
  const data = buildInvoiceData(order, settings, 'INV-00007', new Date('2026-07-09T00:00:00Z'))

  it('carries identity + store + bill-to', () => {
    expect(data.invoiceNumber).toBe('INV-00007')
    expect(data.storeName).toBe('Acme')
    expect(data.orderNumber).toBe('ORD-00007')
    expect(data.billTo.email).toBe('buyer@example.com')
    expect(data.billTo.city).toBe('Metropolis')
  })

  it('formats every amount from minor units in the order currency', () => {
    expect(data.subtotal).toBe('$50.00')
    expect(data.discount).toBe('$5.00')
    expect(data.shipping).toBe('$3.00')
    expect(data.tax).toBe('$3.60')
    expect(data.total).toBe('$51.60')
    expect(data.lines[0]).toMatchObject({ title: 'Widget', variantTitle: 'Blue', qty: 2, unitPrice: '$20.00', lineTotal: '$40.00' })
  })

  it('omits zero discount/shipping/tax', () => {
    const d = buildInvoiceData({ ...(order as Record<string, unknown>), discountAmount: 0, shippingAmount: 0, taxAmount: 0 } as never, settings, 'INV-1', new Date())
    expect(d.discount).toBeNull()
    expect(d.shipping).toBeNull()
    expect(d.tax).toBeNull()
  })
})

describe('buildInvoiceData — tax invoices', () => {
  // AED 100.00 inclusive of 5% VAT: 4.76 of the 100.00 is tax, net 95.24.
  const taxed = (over: Record<string, unknown> = {}) =>
    ({
      ...(order as unknown as Record<string, unknown>),
      currency: 'AED',
      // Line items sum to the subtotal, as `computeOrderAmounts` guarantees for
      // any real order. They used to sum to 5000 against a subtotal of 10000,
      // which was harmless only while nothing read the lines.
      lineItems: [
        { title: 'Widget', qty: 1, unitPrice: 10000, lineTotal: 10000, isGiftCard: false },
      ],
      subtotal: 10000,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 476,
      taxRate: 5,
      taxInclusive: true,
      supplierTrn: '100123456700003',
      total: 10000,
      ...over,
    }) as never

  it('is a tax invoice only when a TRN travelled with the order', () => {
    // Printing "Tax Invoice" without a TRN is itself non-compliant.
    expect(buildInvoiceData(taxed(), null, 'INV-1', new Date()).isTaxInvoice).toBe(true)
    expect(
      buildInvoiceData(taxed({ supplierTrn: null }), null, 'INV-1', new Date()).isTaxInvoice,
    ).toBe(false)
  })

  it('carries the TRN and a rate-labelled VAT line', () => {
    const d = buildInvoiceData(taxed(), null, 'INV-1', new Date())
    expect(d.supplierTrn).toBe('100123456700003')
    expect(d.taxLabel).toBe('VAT (5%)')
  })

  it('shows a zero VAT line rather than hiding it, once registered', () => {
    // A registered merchant's zero-rated order must show 0.00, not vanish.
    // This is what `nonZero()` used to get wrong.
    const d = buildInvoiceData(taxed({ taxAmount: 0 }), null, 'INV-1', new Date())
    expect(d.tax).not.toBeNull()
    expect(d.tax).toContain('0')
  })

  it('hides the VAT line entirely for an unregistered store', () => {
    const d = buildInvoiceData(
      taxed({ taxAmount: 0, taxRate: null, taxInclusive: null, supplierTrn: null }),
      null,
      'INV-1',
      new Date(),
    )
    expect(d.isTaxInvoice).toBe(false)
    expect(d.tax).toBeNull()
    expect(d.taxLabel).toBeNull()
  })

  it('exposes the taxable (net) amount so inclusive arithmetic is legible', () => {
    // Inclusive: the shopper paid 100.00, of which 4.76 was VAT. Showing the
    // 95.24 net is what makes the total add up on the page.
    const d = buildInvoiceData(taxed(), null, 'INV-1', new Date())
    expect(d.taxableAmount).toBe('AED\u00a095.24')
  })

  it('excludes gift-card lines from the taxable amount, so the VAT line reconciles', () => {
    // AED 100 of goods plus an AED 200 gift card, 5% inclusive. The VAT was
    // charged on the GOODS only — selling a card is taking a deposit, not
    // making a taxable supply — so the net printed above that VAT line has to
    // be the goods' net, not the whole subtotal.
    //
    // Deriving it from `order.subtotal` printed "Taxable amount AED 295.24"
    // directly above "VAT (5%) AED 4.76", an implied rate of about 1.6%. This
    // is a compliance document Niblr issues under the merchant's name, so a
    // figure that does not reconcile is Niblr's output, not their mistake.
    const d = buildInvoiceData(
      taxed({
        lineItems: [
          { title: 'Widget', qty: 1, unitPrice: 10000, lineTotal: 10000, isGiftCard: false },
          { title: 'Gift Card', qty: 1, unitPrice: 20000, lineTotal: 20000, isGiftCard: true },
        ],
        subtotal: 30000,
        total: 30000,
      }),
      null,
      'INV-1',
      new Date(),
    )
    expect(d.taxableAmount).toBe('AED 95.24')
    expect(d.tax).toBe('AED 4.76')
    // The two figures must add back up to the taxable gross (the goods, 100.00).
    // 9524 + 476 = 10000, in integer minor units.
    expect(9524 + 476).toBe(10000)
  })

  it('keeps a gift-card-only order off the taxable line entirely', () => {
    // Nothing taxable was supplied, so the net is zero rather than the card's
    // face value. `taxableBaseOf` clamps at 0, so this can never go negative.
    const d = buildInvoiceData(
      taxed({
        lineItems: [
          { title: 'Gift Card', qty: 1, unitPrice: 20000, lineTotal: 20000, isGiftCard: true },
        ],
        subtotal: 20000,
        total: 20000,
        taxAmount: 0,
      }),
      null,
      'INV-1',
      new Date(),
    )
    expect(d.taxableAmount).toBe('AED 0.00')
  })

  it('does not claim a net line when tax was added on top', () => {
    // Exclusive: subtotal already IS the net, so a separate taxable line would
    // just repeat it.
    const d = buildInvoiceData(
      taxed({ taxInclusive: false, taxAmount: 500, total: 10500 }),
      null,
      'INV-1',
      new Date(),
    )
    expect(d.taxableAmount).toBeNull()
  })
})
