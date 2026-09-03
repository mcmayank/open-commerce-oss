import { describe, it, expect } from 'vitest'
import { buildCartSummary } from './cart-summary'
import type { Product } from '@/payload-types'

const product = (over: Partial<Product>): Product =>
  ({ id: 1, title: 'Croissant', slug: 'croissant', price: 1800, stock: 5, images: [], variants: [], ...over } as unknown as Product)

describe('buildCartSummary', () => {
  it('enriches a simple line with price, line total, count', () => {
    const products = [product({ id: 1, title: 'Plain Croissant', slug: 'plain', price: 1800 })]
    const s = buildCartSummary([{ productId: '1', qty: 2 }], products, 'AED')
    expect(s.lines).toHaveLength(1)
    expect(s.lines[0]).toMatchObject({ productId: '1', title: 'Plain Croissant', unitPrice: 1800, qty: 2, lineTotal: 3600, slug: 'plain' })
    expect(s.count).toBe(2)
    expect(s.total).toBe(3600)
    expect(s.currency).toBe('AED')
  })

  it('uses the variant price and title when variantId is present', () => {
    const products = [product({ id: 1, variants: [{ id: 'v1', title: 'Large', price: 2200, sku: null, stock: 3 }] as any })]
    const s = buildCartSummary([{ productId: '1', variantId: 'v1', qty: 1 }], products, 'AED')
    expect(s.lines[0]).toMatchObject({ variantId: 'v1', variantTitle: 'Large', unitPrice: 2200, lineTotal: 2200 })
  })

  it('drops lines whose product is missing or variant is gone (self-healing)', () => {
    const products = [product({ id: 1, variants: [] })]
    expect(buildCartSummary([{ productId: '9', qty: 1 }], products, 'AED').lines).toHaveLength(0)
    expect(buildCartSummary([{ productId: '1', variantId: 'gone', qty: 1 }], products, 'AED').lines).toHaveLength(0)
  })

  it('exposes the first image url when present', () => {
    const products = [product({ id: 1, images: [{ url: '/api/media/file/x.png', alt: 'x' }] as any })]
    expect(buildCartSummary([{ productId: '1', qty: 1 }], products, 'AED').lines[0].image).toBe('/api/media/file/x.png')
  })
})

describe('buildCartSummary — VAT shown before payment', () => {
  const products = [product({ price: 10000 })]
  const cart = [{ productId: '1', qty: 1 }] as never
  const uae = { enabled: true, rate: 5, pricesIncludeTax: true, registrationNumber: '1001' }

  it('shows inclusive VAT as contained in the total, not added to it', () => {
    const s = buildCartSummary(cart, products, 'AED', uae)
    expect(s.total).toBe(10000) // unchanged — the shopper pays the listed price
    expect(s.tax).toEqual({ label: 'Includes VAT (5%)', amountMinor: 476, inclusive: true })
  })

  it('adds exclusive VAT to the total the shopper will pay', () => {
    const s = buildCartSummary(cart, products, 'AED', { ...uae, pricesIncludeTax: false })
    expect(s.total).toBe(10500)
    expect(s.tax).toEqual({ label: 'VAT (5%)', amountMinor: 500, inclusive: false })
  })

  it('shows nothing at all for an unregistered store', () => {
    expect(buildCartSummary(cart, products, 'AED', { ...uae, enabled: false }).tax).toBeNull()
    expect(buildCartSummary(cart, products, 'AED').tax).toBeNull()
  })

  it('leaves the total untouched when no tax config is supplied', () => {
    expect(buildCartSummary(cart, products, 'AED').total).toBe(10000)
  })
})

/**
 * Gift cards are not a taxable supply — the VAT lands later, on whatever the
 * card buys. The order path has always known this (`taxableBaseOf`, guarded by
 * `orders.giftcard-tax.test.ts`); the cart drawer did not, because
 * `CartSummaryLine` carried no `isGiftCard` at all and the tax was computed
 * off the raw line total.
 *
 * Observed in a browser: gift card 10000 + danish 2800 at 5% exclusive emitted
 * `total: 13440, tax: 640` in the cart's RSC payload, against an order that
 * charged 12940. The shopper saw AED 134.40 first and paid AED 129.40.
 */
describe('buildCartSummary — gift cards are outside the taxable base', () => {
  const giftCard = product({ id: 1, title: 'Gift card', slug: 'gift-card', price: 10000, issuesGiftCard: true } as Partial<Product>)
  const danish = product({ id: 2, title: 'Danish', slug: 'danish', price: 2800 })
  const mixedCart = [
    { productId: '1', qty: 1 },
    { productId: '2', qty: 1 },
  ] as never
  const uae = { enabled: true, rate: 5, pricesIncludeTax: false, registrationNumber: '1001' }

  it('taxes only the goods in a mixed cart, and totals what the order charges', () => {
    const s = buildCartSummary(mixedCart, [giftCard, danish], 'AED', uae)

    // Guard against a vacuous pass: both lines really made it in.
    expect(s.lines.map((l) => l.lineTotal)).toEqual([10000, 2800])
    // 2800 × 5% = 140. Taxing the full 12800 subtotal would give 640.
    expect(s.tax).toEqual({ label: 'VAT (5%)', amountMinor: 140, inclusive: false })
    expect(s.tax?.amountMinor).not.toBe(640)
    // The gift card is untaxed but still paid for: 12800 + 140.
    expect(s.total).toBe(12940)
    expect(s.total).not.toBe(13440)
  })

  it('carries isGiftCard onto the line from the product', () => {
    const s = buildCartSummary(mixedCart, [giftCard, danish], 'AED', uae)
    expect(s.lines[0].isGiftCard).toBe(true)
    expect(s.lines[1].isGiftCard).toBe(false)
  })

  it('charges no tax at all on a gift-card-only cart', () => {
    const s = buildCartSummary([{ productId: '1', qty: 1 }] as never, [giftCard], 'AED', uae)
    expect(s.lines).toHaveLength(1)
    expect(s.tax).toEqual({ label: 'VAT (5%)', amountMinor: 0, inclusive: false })
    // Nothing added — the shopper pays the card's face value.
    expect(s.total).toBe(10000)
  })

  it('extracts inclusive VAT from the goods only, and does not move the total', () => {
    const s = buildCartSummary(mixedCart, [giftCard, danish], 'AED', {
      ...uae,
      pricesIncludeTax: true,
    })
    // Extraction, not addition: 2800 × 5 / 105 = 133. The whole 12800 would
    // have given 610.
    expect(s.tax).toEqual({ label: 'Includes VAT (5%)', amountMinor: 133, inclusive: true })
    expect(s.tax?.amountMinor).not.toBe(610)
    // Inclusive never moves the total, gift card or not.
    expect(s.total).toBe(12800)
  })

  it('leaves a mixed cart completely alone when tax is disabled', () => {
    const s = buildCartSummary(mixedCart, [giftCard, danish], 'AED', { ...uae, enabled: false })
    expect(s.tax).toBeNull()
    expect(s.total).toBe(12800)
  })

  it('still returns an empty summary for the no-products early-return path', () => {
    // `getCartSummary` calls exactly this when the cart is empty — no tax
    // config at all, so nothing may divide by or read from one.
    const s = buildCartSummary([], [], 'AED')
    expect(s).toMatchObject({ lines: [], count: 0, total: 0, currency: 'AED', tax: null })
  })
})
