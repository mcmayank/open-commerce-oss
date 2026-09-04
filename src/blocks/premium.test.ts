import { describe, expect, it } from 'vitest'
import { PREMIUM_BLOCK_TYPES, layoutUsesPremium, PREMIUM_VARIANTS, isPremiumVariant } from './premium'

describe('premium blocks', () => {
  it('splitHero is premium', () => {
    expect(PREMIUM_BLOCK_TYPES.has('splitHero')).toBe(true)
    expect(PREMIUM_BLOCK_TYPES.has('hero')).toBe(false)
  })
  it('layoutUsesPremium detects a premium block in a layout', () => {
    expect(layoutUsesPremium([{ blockType: 'hero' }, { blockType: 'splitHero' }])).toBe(true)
    expect(layoutUsesPremium([{ blockType: 'hero' }, { blockType: 'productGrid' }])).toBe(false)
    expect(layoutUsesPremium([])).toBe(false)
    expect(layoutUsesPremium(null)).toBe(false)
    expect(layoutUsesPremium(undefined)).toBe(false)
  })
})

describe('premium variants', () => {
  it('flags the reclassified motion and overlay variants', () => {
    expect(isPremiumVariant('productGrid', 'carousel')).toBe(true)
    expect(isPremiumVariant('logoStrip', 'marquee')).toBe(true)
    expect(isPremiumVariant('ticker', 'marquee')).toBe(true)
    expect(isPremiumVariant('reviews', 'masonry')).toBe(true)
    expect(isPremiumVariant('categoryPreviews', 'overlayCards')).toBe(true)
    expect(isPremiumVariant('promoSection', 'overlay')).toBe(true)
    expect(isPremiumVariant('featuredProduct', 'overlay')).toBe(true)
    expect(isPremiumVariant('videoEmbed', 'textOverlay')).toBe(true)
  })

  it('leaves standard variants free', () => {
    expect(isPremiumVariant('productGrid', 'grid')).toBe(false)
    expect(isPremiumVariant('productGrid', 'list')).toBe(false)
    expect(isPremiumVariant('reviews', 'cards')).toBe(false)
    expect(isPremiumVariant('ticker', 'static')).toBe(false)
  })

  it('is safe on unknown blocks and empty input', () => {
    expect(isPremiumVariant('hero', 'anything')).toBe(false)
    expect(isPremiumVariant('productGrid', null)).toBe(false)
    expect(isPremiumVariant(null, 'carousel')).toBe(false)
    expect(isPremiumVariant(undefined, undefined)).toBe(false)
  })

  it('does not gate splitHero at the variant level (block-level only)', () => {
    expect(PREMIUM_VARIANTS.splitHero).toBeUndefined()
  })
})

describe('hero premium variants', () => {
  it('gates showcase and video, leaves the rest free', () => {
    expect(isPremiumVariant('hero', 'showcase')).toBe(true)
    expect(isPremiumVariant('hero', 'video')).toBe(true)
    for (const v of ['centered', 'split', 'overlay', 'stacked']) {
      expect(isPremiumVariant('hero', v)).toBe(false)
    }
  })
})
