import { describe, expect, it } from 'vitest'
import { summarizeBlocks, blockAvailable, type BlockSummary } from './blocks'
import { Hero } from '@/blocks/Hero/config'
import { SplitHero } from '@/blocks/SplitHero/config'
import { FAQ } from '@/blocks/FAQ/config'
import { CustomSection } from '@/blocks/CustomSection/config'

describe('summarizeBlocks', () => {
  it('summarizes a standard block: slug, not premium, top-level fields with required flags', () => {
    const [hero] = summarizeBlocks([Hero])
    expect(hero.slug).toBe('hero')
    expect(hero.premium).toBe(false)
    expect(hero.fields).toContainEqual({ name: 'heading', type: 'text', required: true })
    expect(hero.fields).toContainEqual({ name: 'subheading', type: 'textarea', required: false })
  })

  it('flags block-level premium blocks (splitHero)', () => {
    const [split] = summarizeBlocks([SplitHero])
    expect(split.slug).toBe('splitHero')
    expect(split.premium).toBe(true)
  })

  it('summarizes only the top-level shape of a nested block (array field listed by name/type)', () => {
    const [faq] = summarizeBlocks([FAQ])
    expect(faq.fields).toContainEqual({ name: 'items', type: 'array', required: false })
    // nested subfields are NOT flattened into the top-level summary
    expect(faq.fields.some((f) => f.name === 'question')).toBe(false)
  })
})

const block = (slug: string, premium = false): BlockSummary => ({ slug, premium, fields: [] })
const NEITHER = { premiumSections: false, customSections: false }
const BOTH = { premiumSections: true, customSections: true }

describe('blockAvailable', () => {
  it('non-premium blocks are always available', () => {
    expect(blockAvailable(block('hero'), NEITHER)).toBe(true)
    expect(blockAvailable(block('hero'), BOTH)).toBe(true)
  })

  it('premium blocks are available only when the plan includes premium sections', () => {
    expect(blockAvailable(block('splitHero', true), NEITHER)).toBe(false)
    expect(blockAvailable(block('splitHero', true), BOTH)).toBe(true)
  })

  /**
   * customSection is not in PREMIUM_BLOCK_TYPES by design, so `premium` is false
   * for it and availability cannot be read off that flag. Before this, every store
   * was told it was usable; a Free store's client would compose a layout with it
   * and assertCustomSections would reject the write with a 403.
   */
  it('reports customSection unavailable without the customSections entitlement', () => {
    expect(blockAvailable(block('customSection'), NEITHER)).toBe(false)
    expect(
      blockAvailable(block('customSection'), { premiumSections: true, customSections: false }),
    ).toBe(false)
  })

  it('reports customSection available once the store has the entitlement', () => {
    expect(
      blockAvailable(block('customSection'), { premiumSections: false, customSections: true }),
    ).toBe(true)
  })

  it('does not let the customSections entitlement unlock unrelated blocks', () => {
    expect(
      blockAvailable(block('splitHero', true), { premiumSections: false, customSections: true }),
    ).toBe(false)
  })

  it('gates the real registered customSection config, not just a slug literal', () => {
    // Pins the wiring end to end: if the block's slug ever changes, the gate map
    // key goes stale and this fails rather than silently opening the block up.
    const [summary] = summarizeBlocks([CustomSection])
    expect(summary.slug).toBe('customSection')
    expect(blockAvailable(summary, NEITHER)).toBe(false)
    expect(blockAvailable(summary, BOTH)).toBe(true)
  })
})
