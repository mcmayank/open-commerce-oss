import { describe, expect, it } from 'vitest'
import { decideRedemption, type GiftCardLike } from './decide'

const card = (over: Partial<GiftCardLike> = {}): GiftCardLike => ({
  balance: 5000,
  currency: 'AED',
  status: 'active',
  ...over,
})

describe('decideRedemption — happy paths', () => {
  it('applies the whole balance when the order costs more', () => {
    expect(decideRedemption(card(), 8000, 'AED')).toEqual({
      ok: true,
      appliedMinor: 5000,
      remainingBalance: 0,
    })
  })

  it('applies only the order total when the balance is larger, leaving the rest', () => {
    expect(decideRedemption(card(), 2000, 'AED')).toEqual({
      ok: true,
      appliedMinor: 2000,
      remainingBalance: 3000,
    })
  })

  it('covers the order exactly', () => {
    expect(decideRedemption(card(), 5000, 'AED')).toEqual({
      ok: true,
      appliedMinor: 5000,
      remainingBalance: 0,
    })
  })
})

describe('decideRedemption — guards', () => {
  it('refuses a voided card', () => {
    const r = decideRedemption(card({ status: 'void' }), 1000, 'AED')
    expect(r.ok).toBe(false)
  })

  it('refuses an empty card', () => {
    const r = decideRedemption(card({ balance: 0 }), 1000, 'AED')
    expect(r.ok).toBe(false)
  })

  it('refuses a currency mismatch rather than converting', () => {
    const r = decideRedemption(card({ currency: 'AED' }), 1000, 'USD')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/currenc/i)
  })

  it('refuses a zero or negative order total', () => {
    expect(decideRedemption(card(), 0, 'AED').ok).toBe(false)
    expect(decideRedemption(card(), -100, 'AED').ok).toBe(false)
  })

  it('refuses a non-integer order total', () => {
    expect(decideRedemption(card(), 10.5, 'AED').ok).toBe(false)
  })
})

describe('decideRedemption — invariants', () => {
  it('never applies more than the balance or more than the order', () => {
    for (const balance of [1, 999, 5000, 100000]) {
      for (const total of [1, 500, 5000, 250000]) {
        const r = decideRedemption(card({ balance }), total, 'AED')
        if (r.ok) {
          expect(r.appliedMinor).toBeLessThanOrEqual(balance)
          expect(r.appliedMinor).toBeLessThanOrEqual(total)
          expect(r.remainingBalance).toBe(balance - r.appliedMinor)
          expect(r.remainingBalance).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})
