import { describe, expect, it } from 'vitest'
import { computeOrderAmounts, discountableBaseOf, taxableBaseOf, type OrderLineItem } from './orders-math'
import { applyDiscount } from './discount'
import { computeTax } from './tax'

/**
 * Pins the tax point the whole gift card design rests on: selling a card is
 * taking a deposit, so it carries no VAT. The tax is charged when the card is
 * SPENT, on the goods it buys.
 *
 * Imports the real `taxableBaseOf` from `orders-math.ts` — the same function
 * `buildOrderFromCart` calls in `orders.ts` — rather than a local mirror, so a
 * regression in the production rule actually turns this test red. Verify that
 * by hand before trusting it.
 */
const line = (over: Partial<OrderLineItem> = {}): OrderLineItem => ({
  productId: 'p1',
  title: 'Thing',
  unitPrice: 10000,
  qty: 1,
  lineTotal: 10000,
  ...over,
})

describe('gift cards are not taxed at sale', () => {
  it('a gift-card-only order has zero tax at 5% inclusive', () => {
    const items = [line({ isGiftCard: true })]
    const base = taxableBaseOf(items, 0, 0)
    const tax = computeTax(base, { enabled: true, rate: 5, pricesIncludeTax: true })
    expect(base).toBe(0)
    expect(tax.taxMinor).toBe(0)
  })

  it('a mixed order taxes only the non-gift-card lines', () => {
    const items = [line({ isGiftCard: true }), line({ productId: 'p2', unitPrice: 21000, lineTotal: 21000 })]
    const base = taxableBaseOf(items, 0, 0)
    expect(base).toBe(21000)

    const tax = computeTax(base, { enabled: true, rate: 5, pricesIncludeTax: true })
    // 21000 * 5 / 105 = 1000 exactly.
    expect(tax.taxMinor).toBe(1000)
  })

  it('the order total still includes the gift card line', () => {
    const items = [line({ isGiftCard: true }), line({ productId: 'p2', unitPrice: 21000, lineTotal: 21000 })]
    const { subtotal, total } = computeOrderAmounts(items, 0, 0, 0)
    expect(subtotal).toBe(31000)
    expect(total).toBe(31000)
  })
})

/**
 * The discount base is the other half of the same rule. `taxableBaseOf`
 * subtracts the WHOLE discount from a base that already excludes gift-card
 * lines, so a discount computed over the full subtotal can exceed that base and
 * wipe out tax on a real supply.
 *
 * Unit-level guard on the pure function only; the end-to-end pin that
 * `buildOrderFromCart` actually passes this base to `applyDiscount` lives in
 * `tests/int/gift-card-discount.int.spec.ts`, because a test that recomposed
 * the three functions here would stay green if that wiring were reverted.
 */
describe('gift cards are not discountable', () => {
  it('excludes gift-card lines from the discount base on a mixed cart', () => {
    const items = [
      line({ productId: 'goods', unitPrice: 10000, lineTotal: 10000 }),
      line({ productId: 'gc', unitPrice: 90000, lineTotal: 90000, isGiftCard: true }),
    ]
    expect(discountableBaseOf(items)).toBe(10000)
  })

  it('gives a gift-card-only cart a discount base of zero', () => {
    expect(discountableBaseOf([line({ isGiftCard: true })])).toBe(0)
  })

  it('caps a 20% code at the goods, keeping the taxable base positive', () => {
    const items = [
      line({ productId: 'goods', unitPrice: 10000, lineTotal: 10000 }),
      line({ productId: 'gc', unitPrice: 90000, lineTotal: 90000, isGiftCard: true }),
    ]
    const { discountAmount } = applyDiscount(discountableBaseOf(items), {
      type: 'percent',
      value: 20,
      active: true,
    })
    expect(discountAmount).toBe(2000)
    // Against the full subtotal the discount would have been 20000 and this
    // base 0 — zero VAT on a 10000 taxable supply.
    expect(taxableBaseOf(items, discountAmount, 0)).toBe(8000)
  })

  it('a fixed-amount code cannot eat into gift-card money either', () => {
    const items = [
      line({ productId: 'goods', unitPrice: 10000, lineTotal: 10000 }),
      line({ productId: 'gc', unitPrice: 90000, lineTotal: 90000, isGiftCard: true }),
    ]
    const { discountAmount } = applyDiscount(discountableBaseOf(items), {
      type: 'fixed',
      value: 50000,
      active: true,
    })
    expect(discountAmount).toBe(10000) // capped at the goods, not at 100000
    expect(taxableBaseOf(items, discountAmount, 0)).toBe(0)
  })
})
