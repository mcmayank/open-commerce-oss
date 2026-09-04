import { describe, it, expect } from 'vitest'
import { reviewGate, projectedVariationRequests, describeDuration, type ReviewItem } from './review'

function item(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 1,
    status: 'selected',
    warnings: [],
    variantCount: 1,
    priceMinor: 1000,
    ...overrides,
  }
}

function gate(overrides: Parameters<typeof reviewGate>[0] extends infer T ? Partial<T> : never = {}) {
  return reviewGate({
    items: [item()],
    ownershipAttested: true,
    taxTreatment: 'exclusive',
    maxProducts: 30,
    existingProductCount: 0,
    ...overrides,
  })
}

const codes = (g: ReturnType<typeof reviewGate>) => g.blockers.map((b) => b.code)

describe('reviewGate', () => {
  it('allows import when everything is answered and something is selected', () => {
    const result = gate()

    expect(result.canImport).toBe(true)
    expect(result.blockers).toEqual([])
  })

  it('blocks when nothing is selected', () => {
    const result = gate({ items: [item({ status: 'skipped' })] })

    expect(result.canImport).toBe(false)
    expect(codes(result)).toContain('no_selection')
  })

  // Not decoration: this is the record you want to exist if it is disputed.
  it('blocks until ownership is attested', () => {
    const result = gate({ ownershipAttested: false })

    expect(result.canImport).toBe(false)
    expect(codes(result)).toContain('ownership_not_attested')
  })

  // Guessing makes every price in the catalog 5% wrong, silently and forever.
  it('blocks until the tax question is answered', () => {
    const result = gate({ taxTreatment: null })

    expect(result.canImport).toBe(false)
    expect(codes(result)).toContain('tax_treatment_unanswered')
  })

  it('blocks a selected item that still has no price', () => {
    const result = gate({
      items: [item({ warnings: ['no_price'], priceMinor: null })],
    })

    expect(result.canImport).toBe(false)
    expect(codes(result)).toContain('selected_item_without_price')
  })

  it('allows a no_price item once a price has been supplied', () => {
    const result = gate({ items: [item({ warnings: ['no_price'], priceMinor: 2500 })] })

    expect(result.canImport).toBe(true)
  })

  it('ignores an unpriced item that is not selected', () => {
    const result = gate({
      items: [item(), item({ status: 'skipped', warnings: ['no_price'], priceMinor: null })],
    })

    expect(result.canImport).toBe(true)
  })

  // Refusing up front beats importing 30 of 250 and then throwing, which looks
  // like success until the merchant counts.
  it('blocks when the selection would exceed the plan cap, naming both numbers', () => {
    const result = gate({
      items: Array.from({ length: 10 }, (_, i) => item({ id: i })),
      maxProducts: 30,
      existingProductCount: 25,
    })

    expect(result.canImport).toBe(false)
    const blocker = result.blockers.find((b) => b.code === 'over_plan_cap')
    expect(blocker?.message).toMatch(/30/)
    expect(blocker?.message).toMatch(/25|5/)
  })

  it('allows a selection that exactly fills the plan cap', () => {
    const result = gate({
      items: Array.from({ length: 5 }, (_, i) => item({ id: i })),
      maxProducts: 30,
      existingProductCount: 25,
    })

    expect(result.canImport).toBe(true)
  })

  it('reports every blocker at once rather than one at a time', () => {
    const result = gate({ ownershipAttested: false, taxTreatment: null, items: [] })

    expect(codes(result)).toEqual(
      expect.arrayContaining(['no_selection', 'ownership_not_attested', 'tax_treatment_unanswered']),
    )
  })
})

describe('projectedVariationRequests', () => {
  // WooCommerce cannot batch variation fetches, so this is the number that
  // decides whether an import takes seconds or minutes.
  it('counts one request per variant beyond the first', () => {
    expect(projectedVariationRequests([item({ variantCount: 1 })])).toBe(0)
    expect(projectedVariationRequests([item({ variantCount: 5 })])).toBe(5)
    expect(
      projectedVariationRequests([item({ variantCount: 5 }), item({ variantCount: 3 })]),
    ).toBe(8)
  })

  it('counts only selected items', () => {
    expect(
      projectedVariationRequests([
        item({ variantCount: 5 }),
        item({ status: 'skipped', variantCount: 100 }),
      ]),
    ).toBe(5)
  })
})

describe('describeDuration', () => {
  it('says nothing for a small import', () => {
    expect(describeDuration(0)).toBeNull()
    expect(describeDuration(5)).toBeNull()
  })

  // The per-origin pacing in safeFetch is deliberate, so a large variable
  // catalog genuinely takes minutes. Saying so beats a spinner that looks stuck.
  it('warns in minutes once the fan-out is large', () => {
    const message = describeDuration(2500)

    expect(message).toMatch(/minute/i)
    expect(message).toMatch(/2,?500/)
  })
})
