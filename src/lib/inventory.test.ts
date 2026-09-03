import { describe, expect, it } from 'vitest'
import { tracksInventory, isInStock } from './inventory'

describe('tracksInventory', () => {
  it('is false for a gift-card product — the card is generated, not stocked', () => {
    expect(tracksInventory({ issuesGiftCard: true })).toBe(false)
  })

  it('is true for a normal product, however the flag is spelled as absent', () => {
    expect(tracksInventory({ issuesGiftCard: false })).toBe(true)
    expect(tracksInventory({ issuesGiftCard: null })).toBe(true)
    expect(tracksInventory({})).toBe(true)
  })

  it('treats a missing product as inventory-tracked (fail closed, not open)', () => {
    expect(tracksInventory(null)).toBe(true)
    expect(tracksInventory(undefined)).toBe(true)
  })
})

describe('isInStock', () => {
  it('gates a normal product on its stock number', () => {
    expect(isInStock({ issuesGiftCard: false }, 1)).toBe(true)
    expect(isInStock({ issuesGiftCard: false }, 0)).toBe(false)
    expect(isInStock({}, 0)).toBe(false)
  })

  it('never gates a gift card, including at the schema default of 0', () => {
    expect(isInStock({ issuesGiftCard: true }, 0)).toBe(true)
    expect(isInStock({ issuesGiftCard: true }, null)).toBe(true)
    expect(isInStock({ issuesGiftCard: true }, undefined)).toBe(true)
  })

  it('treats a null/undefined stock on a normal product as none', () => {
    expect(isInStock({ issuesGiftCard: false }, null)).toBe(false)
    expect(isInStock({ issuesGiftCard: false }, undefined)).toBe(false)
  })

  it('does not let a negative stock read as available', () => {
    expect(isInStock({}, -3)).toBe(false)
  })
})
