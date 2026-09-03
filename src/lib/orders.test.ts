import { describe, it, expect } from 'vitest'
import { computeOrderAmounts } from './orders-math'
import type { OrderLineItem } from './orders-math'

function makeLines(items: Array<{ price: number; qty: number }>): OrderLineItem[] {
  return items.map((item, i) => ({
    productId: `p${i}`,
    title: `Product ${i}`,
    unitPrice: item.price,
    qty: item.qty,
    lineTotal: item.price * item.qty,
  }))
}

describe('computeOrderAmounts — money math', () => {
  it('computes subtotal as sum of all lineTotals', () => {
    const lines = makeLines([
      { price: 1000, qty: 2 },
      { price: 500, qty: 3 },
    ])
    const { subtotal } = computeOrderAmounts(lines, 0, 0, 0)
    expect(subtotal).toBe(3500) // 2000 + 1500
  })

  it('total equals subtotal when no discount/shipping/tax', () => {
    const lines = makeLines([{ price: 7500, qty: 1 }])
    const { subtotal, total } = computeOrderAmounts(lines, 0, 0, 0)
    expect(subtotal).toBe(7500)
    expect(total).toBe(7500)
  })

  it('subtracts discount amount from total', () => {
    const lines = makeLines([{ price: 10000, qty: 1 }])
    const { subtotal, total } = computeOrderAmounts(lines, 1000, 0, 0)
    expect(subtotal).toBe(10000)
    expect(total).toBe(9000)
  })

  it('adds shipping amount to total', () => {
    const lines = makeLines([{ price: 5000, qty: 1 }])
    const { total } = computeOrderAmounts(lines, 0, 250, 0)
    expect(total).toBe(5250)
  })

  it('adds tax amount to total', () => {
    const lines = makeLines([{ price: 5000, qty: 1 }])
    const { total } = computeOrderAmounts(lines, 0, 0, 500)
    expect(total).toBe(5500)
  })

  it('combines discount, shipping, and tax correctly', () => {
    // subtotal = 2000*2 + 1500*1 = 5500
    const lines = makeLines([
      { price: 2000, qty: 2 },
      { price: 1500, qty: 1 },
    ])
    const { subtotal, total } = computeOrderAmounts(lines, 500, 100, 50)
    expect(subtotal).toBe(5500)
    expect(total).toBe(5150) // 5500 - 500 + 100 + 50
  })

  it('total is never negative even if discount exceeds subtotal', () => {
    const lines = makeLines([{ price: 100, qty: 1 }])
    const { total } = computeOrderAmounts(lines, 5000, 0, 0) // discount >> subtotal
    expect(total).toBe(0)
  })

  it('handles large quantities with integer precision', () => {
    const lines = makeLines([{ price: 333, qty: 3 }])
    const { subtotal, total } = computeOrderAmounts(lines, 0, 0, 0)
    expect(subtotal).toBe(999)
    expect(total).toBe(999)
    expect(Number.isInteger(subtotal)).toBe(true)
    expect(Number.isInteger(total)).toBe(true)
  })

  it('handles empty cart (zero subtotal)', () => {
    const { subtotal, total } = computeOrderAmounts([], 0, 0, 0)
    expect(subtotal).toBe(0)
    expect(total).toBe(0)
  })

  it('multi-line with variant-priced items computes correct totals', () => {
    // e.g. ₹200 x3, ₹500 x1, ₹150 x2 = 600 + 500 + 300 = 1400
    const lines = makeLines([
      { price: 200, qty: 3 },
      { price: 500, qty: 1 },
      { price: 150, qty: 2 },
    ])
    const { subtotal, total } = computeOrderAmounts(lines, 100, 50, 0)
    expect(subtotal).toBe(1400)
    expect(total).toBe(1350) // 1400 - 100 + 50
  })

  it('shipping + tax can make total larger than subtotal', () => {
    const lines = makeLines([{ price: 1000, qty: 1 }])
    const { total } = computeOrderAmounts(lines, 0, 500, 200)
    expect(total).toBe(1700)
  })
})
