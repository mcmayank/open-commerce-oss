import { describe, expect, it } from 'vitest'
import { summarizeOrders } from './orders-math'

describe('summarizeOrders', () => {
  it('counts orders that were paid (paidAt set), across fulfillment states', () => {
    const orders = [
      { paidAt: '2026-07-01T00:00:00Z', status: 'paid', total: 1000 },
      { paidAt: '2026-07-02T00:00:00Z', status: 'shipped', total: 2000 },
      { paidAt: '2026-07-03T00:00:00Z', status: 'delivered', total: 3000 },
    ]
    const result = summarizeOrders(orders)
    expect(result.count).toBe(3)
    expect(result.revenueMinor).toBe(6000)
  })

  it('excludes never-paid orders (no paidAt)', () => {
    const orders = [
      { paidAt: null, status: 'pending', total: 500 },
      { paidAt: null, status: 'pending', total: 700 },
    ]
    const result = summarizeOrders(orders)
    expect(result.count).toBe(0)
    expect(result.revenueMinor).toBe(0)
  })

  it('excludes reversed orders (cancelled/refunded) even if paidAt is set', () => {
    const orders = [
      { paidAt: '2026-07-01T00:00:00Z', status: 'cancelled', total: 1000 },
      { paidAt: '2026-07-02T00:00:00Z', status: 'refunded', total: 2000 },
    ]
    const result = summarizeOrders(orders)
    expect(result.count).toBe(0)
    expect(result.revenueMinor).toBe(0)
  })

  it('treats null/undefined total as 0', () => {
    const orders = [
      { paidAt: '2026-07-01T00:00:00Z', status: 'paid', total: null },
      { paidAt: '2026-07-02T00:00:00Z', status: 'paid', total: null },
      { paidAt: '2026-07-03T00:00:00Z', status: 'paid', total: 500 },
    ]
    const result = summarizeOrders(orders)
    expect(result.count).toBe(3)
    expect(result.revenueMinor).toBe(500)
  })

  it('returns zeros for an empty array', () => {
    const result = summarizeOrders([])
    expect(result.count).toBe(0)
    expect(result.revenueMinor).toBe(0)
  })
})

describe('summarizeOrders — partial refunds', () => {
  const paid = (over: Record<string, unknown> = {}) =>
    ({ paidAt: '2026-07-20T10:00:00.000Z', status: 'paid', total: 10000, ...over }) as never

  it('nets a partial refund off revenue', () => {
    // The order is still a sale — it just brought in less than it charged.
    const r = summarizeOrders([paid({ refundedAmount: 2500 })])
    expect(r.count).toBe(1)
    expect(r.revenueMinor).toBe(7500)
  })

  it('still excludes a fully refunded order outright', () => {
    const r = summarizeOrders([paid({ status: 'refunded', refundedAmount: 10000 })])
    expect(r).toEqual({ count: 0, revenueMinor: 0 })
  })

  it('is unaffected when nothing was refunded', () => {
    expect(summarizeOrders([paid(), paid({ refundedAmount: 0 })])).toEqual({
      count: 2,
      revenueMinor: 20000,
    })
  })

  it('never lets a refund push an order below zero', () => {
    expect(summarizeOrders([paid({ refundedAmount: 99999 })]).revenueMinor).toBe(0)
  })
})
