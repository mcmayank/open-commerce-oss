import { describe, expect, it } from 'vitest'
import { collectMediaRefs, resolvePackRefs, type RefMaps } from './resolve-refs'
import type { PackBlock } from './types'

const maps: RefMaps = {
  products: new Map([['sourdough', 11]]),
  categories: new Map([['breads', 22]]),
  media: new Map([['loaf.webp', 33]]),
}

describe('resolvePackRefs', () => {
  it('resolves a single reference', () => {
    const out = resolvePackRefs([{ blockType: 'mediaHero', media: { $media: 'loaf.webp' } }], maps)
    expect(out[0].media).toBe(33)
  })

  it('resolves references inside arrays', () => {
    const out = resolvePackRefs(
      [{ blockType: 'imageGallery', images: [{ $media: 'loaf.webp' }, { $media: 'loaf.webp' }] }],
      maps,
    )
    expect(out[0].images).toEqual([33, 33])
  })

  // The load-bearing property: a block added to the codebase later, with a
  // relationship field this resolver has never heard of, must still work.
  it('resolves a reference in a field it has no knowledge of', () => {
    const out = resolvePackRefs(
      [{ blockType: 'somethingInventedLater', deeply: { nested: [{ thing: { $product: 'sourdough' } }] } }],
      maps,
    )
    expect((out[0].deeply as { nested: { thing: number }[] }).nested[0].thing).toBe(11)
  })

  it('resolves each reference kind against its own map', () => {
    const out = resolvePackRefs(
      [{ blockType: 'x', a: { $product: 'sourdough' }, b: { $category: 'breads' }, c: { $media: 'loaf.webp' } }],
      maps,
    )
    expect([out[0].a, out[0].b, out[0].c]).toEqual([11, 22, 33])
  })

  it('leaves a block with no references byte-identical', () => {
    const block: PackBlock = { blockType: 'newsletterSignup', heading: 'Hi', items: [{ a: 1 }] }
    expect(resolvePackRefs([block], maps)).toEqual([block])
  })

  // Only a SINGLE-key object is a reference. A block field legitimately named
  // `$product` alongside other keys is data, not a pointer.
  it('leaves a multi-key object containing a $ key alone', () => {
    const block: PackBlock = { blockType: 'x', weird: { $product: 'sourdough', label: 'kept' } }
    expect(resolvePackRefs([block], maps)).toEqual([block])
  })

  it('throws naming the slug when a reference does not resolve', () => {
    expect(() =>
      resolvePackRefs([{ blockType: 'featuredProduct', product: { $product: 'no-such-thing' } }], maps),
    ).toThrow(/no-such-thing/)
  })

  it('names the block type in the error, so a bad pack is findable', () => {
    expect(() =>
      resolvePackRefs([{ blockType: 'featuredProduct', product: { $product: 'nope' } }], maps),
    ).toThrow(/featuredProduct/)
  })

  it('does not mutate the input', () => {
    const block: PackBlock = { blockType: 'mediaHero', media: { $media: 'loaf.webp' } }
    resolvePackRefs([block], maps)
    expect(block.media).toEqual({ $media: 'loaf.webp' })
  })
})

describe('collectMediaRefs', () => {
  it('finds every media filename, deduplicated, ignoring other ref kinds', () => {
    const found = collectMediaRefs([
      { blockType: 'mediaHero', media: { $media: 'a.webp' }, poster: { $media: 'b.webp' } },
      { blockType: 'imageGallery', images: [{ $media: 'a.webp' }] },
      { blockType: 'featuredProduct', product: { $product: 'sourdough' } },
    ])
    expect(found.sort()).toEqual(['a.webp', 'b.webp'])
  })

  it('returns an empty array for an undefined layout', () => {
    expect(collectMediaRefs(undefined)).toEqual([])
  })
})
