import { describe, expect, it } from 'vitest'
import { findNewPremiumVariants } from './premium-diff'

const free = { id: 'a1', blockType: 'productGrid', variant: 'grid' }
const premium = { id: 'b2', blockType: 'productGrid', variant: 'carousel' }

describe('findNewPremiumVariants', () => {
  it('reports a premium variant on a brand-new page (no original)', () => {
    expect(findNewPremiumVariants([premium], null)).toEqual([
      { blockType: 'productGrid', variant: 'carousel' },
    ])
  })

  it('grandfathers a premium variant already saved on the same block id', () => {
    expect(findNewPremiumVariants([premium], [premium])).toEqual([])
  })

  it('still grandfathers when the block is reordered', () => {
    expect(findNewPremiumVariants([premium, free], [free, premium])).toEqual([])
  })

  it('reports switching a block TO a premium variant', () => {
    const before = { id: 'b2', blockType: 'productGrid', variant: 'grid' }
    expect(findNewPremiumVariants([premium], [before])).toEqual([
      { blockType: 'productGrid', variant: 'carousel' },
    ])
  })

  it('reports a duplicated premium block (new id)', () => {
    const copy = { id: 'c3', blockType: 'productGrid', variant: 'carousel' }
    expect(findNewPremiumVariants([premium, copy], [premium])).toEqual([
      { blockType: 'productGrid', variant: 'carousel' },
    ])
  })

  it('ignores free variants entirely', () => {
    expect(findNewPremiumVariants([free], null)).toEqual([])
  })

  it('is safe on empty and nullish layouts', () => {
    expect(findNewPremiumVariants([], null)).toEqual([])
    expect(findNewPremiumVariants(null, null)).toEqual([])
    expect(findNewPremiumVariants(undefined, undefined)).toEqual([])
  })

  it('reports one new variant when a grandfathered id is duplicated once', () => {
    expect(findNewPremiumVariants([premium, premium], [premium])).toEqual([
      { blockType: 'productGrid', variant: 'carousel' },
    ])
  })

  it('reports two new variants when a grandfathered id is duplicated twice', () => {
    expect(findNewPremiumVariants([premium, premium, premium], [premium])).toEqual([
      { blockType: 'productGrid', variant: 'carousel' },
      { blockType: 'productGrid', variant: 'carousel' },
    ])
  })

  it('grandfathers two distinct ids independently, not just the first match', () => {
    const premium2 = { id: 'd4', blockType: 'logoStrip', variant: 'marquee' }
    expect(findNewPremiumVariants([premium, premium2], [premium, premium2])).toEqual([])
  })

  it('does not let a non-premium block sharing the grandfathered id consume the match', () => {
    // Regression for a mutant that moves the `before.delete(block.id)` consume
    // above the `isPremiumVariant` check: the first (free-variant) block would
    // then consume `b2` on its way past, leaving nothing for the second block
    // to match, so it would be misreported as new. Correct behaviour is that
    // the free-variant block is skipped before any map access, so the second
    // block still finds and consumes the grandfathered `b2` entry.
    const freeSameId = { id: 'b2', blockType: 'productGrid', variant: 'grid' }
    expect(findNewPremiumVariants([freeSameId, premium], [premium])).toEqual([])
  })

  it('does not throw on a non-array original and still reports correctly', () => {
    expect(findNewPremiumVariants([premium], 'garbage' as unknown as null)).toEqual([
      { blockType: 'productGrid', variant: 'carousel' },
    ])
    expect(findNewPremiumVariants([premium], {} as unknown as null)).toEqual([
      { blockType: 'productGrid', variant: 'carousel' },
    ])
  })
})
