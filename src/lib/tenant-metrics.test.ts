import { describe, expect, it } from 'vitest'
import {
  countPendingFulfillment,
  countLowStock,
  toRecentOrders,
  deriveOnboarding,
  comparePeriods,
} from './tenant-metrics'

describe('countPendingFulfillment', () => {
  it("counts only orders at status 'paid' (paid, awaiting fulfillment)", () => {
    const orders = [
      { status: 'paid' },
      { status: 'paid' },
      { status: 'shipped' },
      { status: 'delivered' },
      { status: 'pending' },
      { status: 'cancelled' },
    ]
    expect(countPendingFulfillment(orders)).toBe(2)
  })

  it('returns 0 for an empty array', () => {
    expect(countPendingFulfillment([])).toBe(0)
  })
})

describe('countLowStock', () => {
  it('counts a non-variant product at zero stock, but NOT a variant product at zero stock', () => {
    const products = [
      { stock: 0, variants: [] },
      { stock: 0, variants: [{ title: 'S / Red' }] },
    ]
    expect(countLowStock(products, 5)).toBe(1)
  })

  it('counts a non-variant product exactly at the threshold, but not one above it', () => {
    const products = [
      { stock: 5, variants: [] },
      { stock: 6, variants: [] },
    ]
    expect(countLowStock(products, 5)).toBe(1)
  })

  it('treats a missing/undefined variants array as no variants', () => {
    expect(countLowStock([{ stock: 2 }], 5)).toBe(1)
  })

  it('never counts a gift-card product, whose stock 0 is not inventory', () => {
    const products = [
      { stock: 0, variants: [], issuesGiftCard: true },
      { stock: 0, variants: [], issuesGiftCard: false },
    ]
    // Only the ordinary product; the gift card would otherwise nag forever.
    expect(countLowStock(products, 5)).toBe(1)
  })

  it('excludes a gift card even when a merchant typed a low stock number in', () => {
    expect(countLowStock([{ stock: 2, issuesGiftCard: true }], 5)).toBe(0)
  })

  it('returns 0 for an empty array', () => {
    expect(countLowStock([], 5)).toBe(0)
  })
})

describe('toRecentOrders', () => {
  it('maps order docs to the compact recent-order shape', () => {
    const result = toRecentOrders([
      { id: 7, orderNumber: 'A-7', status: 'paid', total: 1500, email: 'a@x.com', createdAt: '2026-07-05T00:00:00Z' },
    ])
    expect(result).toEqual([
      { id: 7, orderNumber: 'A-7', status: 'paid', total: 1500, customerLabel: 'a@x.com', createdAt: '2026-07-05T00:00:00Z' },
    ])
  })

  it('falls back to "Guest" when email is missing', () => {
    const result = toRecentOrders([
      { id: 8, orderNumber: 'A-8', status: 'paid', total: 0, email: null, createdAt: '2026-07-06T00:00:00Z' },
    ])
    expect(result[0].customerLabel).toBe('Guest')
  })
})

describe('deriveOnboarding', () => {
  const base = {
    productCount: 0,
    activeGatewayCount: 0,
    storeSettings: null as { storeName?: string | null; currency?: string | null; logo?: unknown } | null,
    verifiedDomainCount: 0,
    tenantStatus: 'pending',
  }

  it('is all-false for a brand-new tenant', () => {
    expect(deriveOnboarding(base)).toEqual({
      hasProduct: false,
      hasGateway: false,
      hasStoreSettings: false,
      hasBranding: false,
      hasDomain: false,
      isLive: false,
    })
  })

  it('flags each step from its signal', () => {
    const result = deriveOnboarding({
      productCount: 3,
      activeGatewayCount: 1,
      storeSettings: { storeName: 'SD Bakery', currency: 'AED', logo: 42 },
      verifiedDomainCount: 1,
      tenantStatus: 'active',
    })
    expect(result).toEqual({
      hasProduct: true,
      hasGateway: true,
      hasStoreSettings: true,
      hasBranding: true,
      hasDomain: true,
      isLive: true,
    })
  })

  it('requires BOTH storeName and currency for hasStoreSettings', () => {
    expect(deriveOnboarding({ ...base, storeSettings: { storeName: 'X', currency: null } }).hasStoreSettings).toBe(false)
    expect(deriveOnboarding({ ...base, storeSettings: { storeName: null, currency: 'AED' } }).hasStoreSettings).toBe(false)
  })

  it('hasBranding is false when logo is null/absent', () => {
    expect(deriveOnboarding({ ...base, storeSettings: { storeName: 'X', currency: 'AED', logo: null } }).hasBranding).toBe(false)
  })
})

const NOW = new Date('2026-08-06T12:00:00.000Z')

/** Days before NOW, as an ISO string. */
const daysAgo = (n: number): string =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

const paid = (n: number, total: number, over = {}) => ({
  status: 'paid',
  total,
  paidAt: daysAgo(n),
  ...over,
})

describe('comparePeriods', () => {
  it('splits orders into the current and previous seven-day windows', () => {
    const result = comparePeriods([paid(1, 1000), paid(3, 2000), paid(9, 500)], NOW)
    expect(result.current.count).toBe(2)
    expect(result.current.revenueMinor).toBe(3000)
    expect(result.previous.count).toBe(1)
    expect(result.previous.revenueMinor).toBe(500)
  })

  it('excludes orders older than both windows', () => {
    const result = comparePeriods([paid(30, 9999)], NOW)
    expect(result.current.count).toBe(0)
    expect(result.previous.count).toBe(0)
    expect(result.previous.revenueMinor).not.toBe(9999)
  })

  it('excludes never-paid orders even inside the window', () => {
    const result = comparePeriods(
      [{ status: 'pending', total: 4000, paidAt: null }, paid(1, 1000)],
      NOW,
    )
    expect(result.current.count).toBe(1)
    expect(result.current.revenueMinor).toBe(1000)
  })

  it('excludes cancelled and refunded orders from revenue', () => {
    const result = comparePeriods(
      [paid(1, 1000, { status: 'refunded' }), paid(2, 1000, { status: 'cancelled' }), paid(3, 700)],
      NOW,
    )
    expect(result.current.count).toBe(1)
    expect(result.current.revenueMinor).toBe(700)
  })

  it('subtracts a partial refund from a still-paid order', () => {
    const full = comparePeriods([paid(1, 1000)], NOW)
    const partial = comparePeriods([paid(1, 1000, { refundedAmount: 400 })], NOW)
    expect(partial.current.revenueMinor).toBe(600)
    expect(partial.current.revenueMinor).toBeLessThan(full.current.revenueMinor)
    expect(partial.current.count).toBe(1)
  })

  it('returns zeroed summaries for no orders', () => {
    const result = comparePeriods([], NOW)
    expect(result).toEqual({
      current: { count: 0, revenueMinor: 0 },
      previous: { count: 0, revenueMinor: 0 },
    })
  })
})
