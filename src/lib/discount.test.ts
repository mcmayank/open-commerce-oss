import { describe, expect, it } from 'vitest'
import { applyDiscount, type DiscountLike } from './discount'

// Helper to build a minimal valid discount code
const pct = (value: number, overrides: Partial<DiscountLike> = {}): DiscountLike => ({
  type: 'percent',
  value,
  active: true,
  ...overrides,
})

const fixed = (value: number, overrides: Partial<DiscountLike> = {}): DiscountLike => ({
  type: 'fixed',
  value,
  active: true,
  ...overrides,
})

describe('applyDiscount – percent type', () => {
  it('10% of 100000 → 10000 (integer minor units)', () => {
    expect(applyDiscount(100000, pct(10))).toEqual({ discountAmount: 10000 })
  })

  it('15% of 99999 → 14999 (floors to integer, no fractional paise)', () => {
    // 99999 * 0.15 = 14999.85 → floor → 14999
    const result = applyDiscount(99999, pct(15))
    expect(result.discountAmount).toBe(14999)
    expect(Number.isInteger(result.discountAmount)).toBe(true)
  })

  it('result is always an integer (no fractional minor units)', () => {
    const result = applyDiscount(333, pct(10))
    expect(Number.isInteger(result.discountAmount)).toBe(true)
  })

  it('100% discount results in discountAmount === subtotal', () => {
    expect(applyDiscount(5000, pct(100))).toEqual({ discountAmount: 5000 })
  })

  it('150% discount is capped at subtotal (never exceeds subtotal)', () => {
    // 150% of 100000 would be 150000 without a cap; must be capped at 100000.
    expect(applyDiscount(100000, pct(150))).toEqual({ discountAmount: 100000 })
  })
})

describe('applyDiscount – fixed type', () => {
  it('fixed 500 off 2000 subtotal → discountAmount 500', () => {
    expect(applyDiscount(2000, fixed(500))).toEqual({ discountAmount: 500 })
  })

  it('fixed discount is capped so total never goes negative (discount cannot exceed subtotal)', () => {
    const result = applyDiscount(300, fixed(1000))
    expect(result.discountAmount).toBe(300)
    expect(result.discountAmount).toBeLessThanOrEqual(300)
  })

  it('fixed discount exactly equal to subtotal → discountAmount === subtotal, total = 0', () => {
    expect(applyDiscount(1000, fixed(1000))).toEqual({ discountAmount: 1000 })
  })
})

describe('applyDiscount – inactive code', () => {
  it('inactive percent → discountAmount 0 + error', () => {
    const result = applyDiscount(10000, pct(10, { active: false }))
    expect(result.discountAmount).toBe(0)
    expect(result.error).toBeTruthy()
  })

  it('inactive fixed → discountAmount 0 + error', () => {
    const result = applyDiscount(10000, fixed(500, { active: false }))
    expect(result.discountAmount).toBe(0)
    expect(result.error).toBeTruthy()
  })
})

describe('applyDiscount – minOrder', () => {
  it('subtotal below minOrder → discountAmount 0 + error', () => {
    const result = applyDiscount(4999, pct(10, { minOrder: 5000 }))
    expect(result.discountAmount).toBe(0)
    expect(result.error).toBeTruthy()
  })

  it('subtotal exactly at minOrder → discount applied', () => {
    const result = applyDiscount(5000, pct(10, { minOrder: 5000 }))
    expect(result.discountAmount).toBe(500)
    expect(result.error).toBeUndefined()
  })

  it('null minOrder means no minimum enforced', () => {
    const result = applyDiscount(100, pct(10, { minOrder: null }))
    expect(result.discountAmount).toBe(10)
  })
})

describe('applyDiscount – usage limit', () => {
  it('usedCount >= usageLimit → error, no discount', () => {
    const result = applyDiscount(10000, pct(10, { usageLimit: 5, usedCount: 5 }))
    expect(result.discountAmount).toBe(0)
    expect(result.error).toBeTruthy()
  })

  it('usedCount > usageLimit → error, no discount', () => {
    const result = applyDiscount(10000, pct(10, { usageLimit: 5, usedCount: 6 }))
    expect(result.discountAmount).toBe(0)
    expect(result.error).toBeTruthy()
  })

  it('usedCount < usageLimit → discount applied', () => {
    const result = applyDiscount(10000, pct(10, { usageLimit: 5, usedCount: 4 }))
    expect(result.discountAmount).toBe(1000)
    expect(result.error).toBeUndefined()
  })

  it('null usageLimit means unlimited usage', () => {
    const result = applyDiscount(10000, pct(10, { usageLimit: null, usedCount: 9999 }))
    expect(result.discountAmount).toBe(1000)
  })
})

describe('applyDiscount – validity window', () => {
  const FIXED_NOW = new Date('2024-06-15T12:00:00Z')

  it('expired code (now > validUntil) → error, no discount', () => {
    const result = applyDiscount(
      10000,
      pct(10, { validUntil: '2024-06-14T23:59:59Z' }),
      FIXED_NOW,
    )
    expect(result.discountAmount).toBe(0)
    expect(result.error).toBeTruthy()
  })

  it('not yet valid (now < validFrom) → error, no discount', () => {
    const result = applyDiscount(
      10000,
      pct(10, { validFrom: '2024-06-16T00:00:00Z' }),
      FIXED_NOW,
    )
    expect(result.discountAmount).toBe(0)
    expect(result.error).toBeTruthy()
  })

  it('within valid window → discount applied', () => {
    const result = applyDiscount(
      10000,
      pct(10, { validFrom: '2024-06-01T00:00:00Z', validUntil: '2024-06-30T23:59:59Z' }),
      FIXED_NOW,
    )
    expect(result.discountAmount).toBe(1000)
    expect(result.error).toBeUndefined()
  })

  it('null validFrom / validUntil → no date restriction', () => {
    const result = applyDiscount(10000, pct(10, { validFrom: null, validUntil: null }), FIXED_NOW)
    expect(result.discountAmount).toBe(1000)
  })
})

describe('applyDiscount – invariants', () => {
  it('discountAmount is always a non-negative integer', () => {
    const cases: [number, DiscountLike][] = [
      [0, pct(10)],
      [1, pct(99)],
      [100000, pct(33)],
      [7, fixed(3)],
    ]
    for (const [subtotal, code] of cases) {
      const { discountAmount } = applyDiscount(subtotal, code)
      expect(Number.isInteger(discountAmount)).toBe(true)
      expect(discountAmount).toBeGreaterThanOrEqual(0)
    }
  })

  it('total (subtotal - discountAmount) is never negative', () => {
    const result = applyDiscount(500, fixed(99999))
    expect(500 - result.discountAmount).toBeGreaterThanOrEqual(0)
  })
})
