import { describe, expect, it } from 'vitest'
import { computeTax, orderTax, type TaxConfig } from './tax'

/**
 * Money is integer minor units end to end. Every expectation here is in minor
 * units (fils for AED, paise for INR) and every one is exact — there is no
 * `toBeCloseTo` in this file on purpose. A rounding error here becomes a wrong
 * number on a tax invoice issued under a merchant's name.
 */

const uae = (over: Partial<TaxConfig> = {}): TaxConfig => ({
  enabled: true,
  rate: 5,
  pricesIncludeTax: true,
  ...over,
})

describe('computeTax — inclusive is extraction, not addition', () => {
  it('extracts 4.76 from a listed AED 100 at 5%', () => {
    // The canonical case. 10000 × 5 / 105 = 476.19 → 476.
    // The total MUST NOT move: the shopper pays what the tag says.
    expect(computeTax(10000, uae())).toEqual({ taxMinor: 476, netMinor: 9524, grossMinor: 10000 })
  })

  it('never changes the gross from the base it was given', () => {
    for (const base of [1, 99, 100, 999, 10000, 123456, 9999999]) {
      expect(computeTax(base, uae()).grossMinor, `base ${base}`).toBe(base)
    }
  })

  it('is not the exclusive calculation in disguise', () => {
    // base × 5 / 100 = 500 is the classic bug. Inclusive must give 476.
    expect(computeTax(10000, uae()).taxMinor).not.toBe(500)
  })
})

describe('computeTax — exclusive adds on top', () => {
  it('adds 5.00 to AED 100 at 5%', () => {
    expect(computeTax(10000, uae({ pricesIncludeTax: false }))).toEqual({
      taxMinor: 500,
      netMinor: 10000,
      grossMinor: 10500,
    })
  })

  it('leaves the net equal to the base', () => {
    for (const base of [1, 250, 10000, 87654]) {
      expect(computeTax(base, uae({ pricesIncludeTax: false })).netMinor).toBe(base)
    }
  })
})

describe('computeTax — zero and disabled', () => {
  it('returns no tax and an unchanged total at 0%, either mode', () => {
    for (const inclusive of [true, false]) {
      expect(computeTax(10000, uae({ rate: 0, pricesIncludeTax: inclusive }))).toEqual({
        taxMinor: 0,
        netMinor: 10000,
        grossMinor: 10000,
      })
    }
  })

  it('returns no tax and an unchanged total when the store is not registered', () => {
    for (const inclusive of [true, false]) {
      expect(computeTax(10000, uae({ enabled: false, pricesIncludeTax: inclusive }))).toEqual({
        taxMinor: 0,
        netMinor: 10000,
        grossMinor: 10000,
      })
    }
  })

  it('handles a zero base', () => {
    expect(computeTax(0, uae())).toEqual({ taxMinor: 0, netMinor: 0, grossMinor: 0 })
  })
})

describe('computeTax — other markets', () => {
  it('handles KSA at 15% inclusive', () => {
    // 10000 × 15 / 115 = 1304.35 → 1304
    expect(computeTax(10000, uae({ rate: 15 }))).toEqual({
      taxMinor: 1304,
      netMinor: 8696,
      grossMinor: 10000,
    })
  })

  it('handles 18% inclusive', () => {
    // 10000 × 18 / 118 = 1525.42 → 1525
    expect(computeTax(10000, uae({ rate: 18 }))).toEqual({
      taxMinor: 1525,
      netMinor: 8475,
      grossMinor: 10000,
    })
  })

  it('handles a fractional rate without floating-point drift', () => {
    // 7.5% inclusive on 10000: 10000 × 7.5 / 107.5 = 697.67 → 698
    expect(computeTax(10000, uae({ rate: 7.5 })).taxMinor).toBe(698)
  })
})

describe('computeTax — rounding', () => {
  it('rounds half up on the minor unit', () => {
    // Exclusive at 50% on an odd base: 3 × 50 / 100 = 1.5 → 2, not 1.
    expect(computeTax(3, uae({ rate: 50, pricesIncludeTax: false })).taxMinor).toBe(2)
  })

  it('never returns a fractional minor unit', () => {
    for (const base of [1, 3, 7, 33, 101, 9999, 123457]) {
      for (const rate of [5, 7.5, 15, 18]) {
        for (const inclusive of [true, false]) {
          const r = computeTax(base, uae({ rate, pricesIncludeTax: inclusive }))
          for (const v of [r.taxMinor, r.netMinor, r.grossMinor]) {
            expect(Number.isInteger(v), `base ${base} rate ${rate} -> ${v}`).toBe(true)
          }
        }
      }
    }
  })
})

describe('computeTax — the invariant', () => {
  it('always satisfies net + tax === gross', () => {
    for (let base = 0; base <= 2000; base += 7) {
      for (const rate of [0, 5, 7.5, 15, 18, 20]) {
        for (const inclusive of [true, false]) {
          const r = computeTax(base, uae({ rate, pricesIncludeTax: inclusive }))
          expect(r.netMinor + r.taxMinor, `base ${base} rate ${rate} incl ${inclusive}`).toBe(
            r.grossMinor,
          )
        }
      }
    }
  })

  it('never returns a negative component', () => {
    for (const base of [0, 1, 5, 100, 10000]) {
      const r = computeTax(base, uae({ rate: 15 }))
      expect(Math.min(r.taxMinor, r.netMinor, r.grossMinor)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('computeTax — bad input', () => {
  it('treats a negative base as zero rather than inventing a credit', () => {
    expect(computeTax(-500, uae())).toEqual({ taxMinor: 0, netMinor: 0, grossMinor: 0 })
  })

  it('treats a negative rate as no tax', () => {
    expect(computeTax(10000, uae({ rate: -5 }))).toEqual({
      taxMinor: 0,
      netMinor: 10000,
      grossMinor: 10000,
    })
  })
})

describe('orderTax — what gets stored and what gets added', () => {
  const lines = 10000 // subtotal − discount + shipping, in minor units

  it('adds NOTHING to the total in inclusive mode', () => {
    // THE trap. The VAT is already inside the line prices, so adding it again
    // would inflate the order by 4.76 on every AED 100 sold. `taxAmount` is
    // still recorded — the invoice must show it — but `taxToAdd` is zero.
    const t = orderTax(lines, uae())
    expect(t.taxAmount).toBe(476)
    expect(t.taxToAdd).toBe(0)
  })

  it('adds the tax to the total in exclusive mode', () => {
    const t = orderTax(lines, uae({ pricesIncludeTax: false }))
    expect(t.taxAmount).toBe(500)
    expect(t.taxToAdd).toBe(500)
  })

  it('snapshots the rate, mode and TRN so a later change cannot restate it', () => {
    const t = orderTax(lines, uae({ registrationNumber: '100123456700003' }))
    expect(t.taxRate).toBe(5)
    expect(t.taxInclusive).toBe(true)
    expect(t.supplierTrn).toBe('100123456700003')
  })

  it('records nothing at all when the store is not registered', () => {
    // An unregistered merchant must not get a VAT line, not even a zero one.
    expect(orderTax(lines, uae({ enabled: false }))).toEqual({
      taxAmount: 0,
      taxToAdd: 0,
      taxRate: null,
      taxInclusive: null,
      supplierTrn: null,
    })
  })

  it('records nothing when there is no tax config at all', () => {
    for (const cfg of [null, undefined]) {
      expect(orderTax(lines, cfg).taxRate).toBeNull()
      expect(orderTax(lines, cfg).taxAmount).toBe(0)
    }
  })

  it('keeps a registered store with a blank TRN out of tax-invoice territory', () => {
    // Printing "Tax Invoice" without a TRN is itself non-compliant, so the
    // absence of a TRN must travel onto the order as null.
    expect(orderTax(lines, uae({ registrationNumber: '  ' })).supplierTrn).toBeNull()
  })
})
