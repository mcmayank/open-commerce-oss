import { describe, expect, it } from 'vitest'
import { itemCount, parseRefundAmount, statusMeta, timelineRows } from './derive'

describe('statusMeta', () => {
  it('maps status to a label + tone', () => {
    expect(statusMeta('paid')).toEqual({ label: 'Paid', tone: 'positive' })
    expect(statusMeta('shipped')).toEqual({ label: 'Shipped', tone: 'info' })
    expect(statusMeta('delivered')).toEqual({ label: 'Delivered', tone: 'positive' })
    expect(statusMeta('pending')).toEqual({ label: 'Pending', tone: 'warning' })
    expect(statusMeta('cancelled')).toEqual({ label: 'Cancelled', tone: 'neutral' })
    expect(statusMeta('refunded')).toEqual({ label: 'Refunded', tone: 'danger' })
    expect(statusMeta('weird')).toEqual({ label: 'Weird', tone: 'neutral' })
  })
})

describe('itemCount', () => {
  it('sums line-item quantities, safe on missing', () => {
    expect(itemCount([{ qty: 2 }, { qty: 1 }])).toBe(3)
    expect(itemCount([])).toBe(0)
    expect(itemCount(undefined)).toBe(0)
    expect(itemCount([{ qty: undefined }, { qty: 2 }])).toBe(2)
  })
})

describe('timelineRows', () => {
  it('includes only present timestamps, newest first', () => {
    const rows = timelineRows({
      createdAt: '2026-07-09T10:00:00Z',
      paidAt: '2026-07-09T10:05:00Z',
      invoiceSentAt: '2026-07-09T10:06:00Z',
      invoiceNumber: 'INV-00007',
    })
    expect(rows.map((r) => r.key)).toEqual(['invoice', 'paid', 'placed'])
    expect(rows[0].title).toContain('INV-00007')
  })
  it('omits rows whose timestamp is missing', () => {
    const rows = timelineRows({ createdAt: '2026-07-09T10:00:00Z' })
    expect(rows.map((r) => r.key)).toEqual(['placed'])
  })
})

describe('parseRefundAmount', () => {
  const remaining = 10000 // AED 100.00

  it('converts a major-unit amount to integer minor units', () => {
    expect(parseRefundAmount('12.50', 'AED', remaining)).toEqual({ ok: true, minor: 1250 })
    expect(parseRefundAmount('100', 'AED', remaining)).toEqual({ ok: true, minor: 10000 })
  })

  it('tolerates whitespace and thousands separators', () => {
    expect(parseRefundAmount(' 1,0.00 ', 'AED', remaining)).toEqual({ ok: true, minor: 1000 })
  })

  it('respects the currency exponent', () => {
    // KWD is a three-decimal currency; JPY has none.
    expect(parseRefundAmount('1.234', 'KWD', 10000)).toEqual({ ok: true, minor: 1234 })
    expect(parseRefundAmount('500', 'JPY', 10000)).toEqual({ ok: true, minor: 500 })
  })

  it('refuses an amount finer than the currency allows', () => {
    // Silently rounding this would move a different sum than the merchant typed.
    const r = parseRefundAmount('12.567', 'AED', remaining)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/2 decimal places/)

    const j = parseRefundAmount('500.5', 'JPY', remaining)
    expect(j.ok).toBe(false)
    if (!j.ok) expect(j.error).toMatch(/no decimal places/)
  })

  it('refuses empty, zero, negative and non-numeric input', () => {
    expect(parseRefundAmount('', 'AED', remaining).ok).toBe(false)
    expect(parseRefundAmount('0', 'AED', remaining).ok).toBe(false)
    expect(parseRefundAmount('-5', 'AED', remaining).ok).toBe(false)
    expect(parseRefundAmount('abc', 'AED', remaining).ok).toBe(false)
  })

  it('refuses more than the amount left on the order', () => {
    const r = parseRefundAmount('100.01', 'AED', remaining)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/left on this order/)
  })
})
