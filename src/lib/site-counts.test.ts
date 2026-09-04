import { describe, expect, it } from 'vitest'
import { PAGE_BLOCKS } from '@/blocks/registry'
import { isPremiumVariant, PREMIUM_BLOCK_TYPES } from '@/blocks/premium'
import { themeCatalog } from '@/themes/catalog'
import {
  BLOCK_COUNT,
  BLOCK_EXAMPLES,
  BLOCKS_WITH_VARIANTS,
  FREE_BLOCK_COUNT,
  MARKETING_BLOCK_SLUGS,
  MARKETING_PREMIUM_BLOCKS,
  MAX_VARIANTS_PER_BLOCK,
  MIN_VARIANTS_PER_BLOCK,
  PREMIUM_BLOCK_COUNT,
  PREMIUM_BLOCK_NAMES,
  PREMIUM_VARIANT_BLOCK_COUNT,
  PREMIUM_VARIANT_COUNT,
  PREMIUM_VARIANT_EXAMPLES,
  TEMPLATE_COUNT,
  THEME_COUNT,
} from './site-counts'

/**
 * Guards the CLAUDE.md rule that site copy derives counts from registries.
 * These fail when someone adds a block or theme and the number stops matching,
 * which is the whole point — the number is supposed to move on its own.
 */
describe('site counts track their registries', () => {
  it('states the number the live site currently claims', () => {
    // A literal on purpose. The old assertion here was
    // `expect(BLOCK_COUNT).toBe(PAGE_BLOCKS.length)` — tautological, since that
    // was the definition, so it could never fail. It stayed green while adding
    // `customSection` to the registry rewrote /features, /templates and the
    // homepage from "23 blocks" to "24". Changing this number means marketing
    // copy on three live pages changes; update it deliberately, in the commit
    // that ships the block a merchant can actually use.
    expect(BLOCK_COUNT).toBe(24)
    expect(FREE_BLOCK_COUNT).toBe(22)
  })

  it('never counts a save-gated block as free', () => {
    // customSection is Premium-gated on save (assertCustomSections), not at
    // render (PREMIUM_BLOCK_TYPES) — gating it at render would strip live
    // sections from a downgraded merchant's pages. MARKETING_PREMIUM_BLOCKS is
    // where that save-time gate is named for the marketing counts, since
    // subtraction (BLOCK_COUNT - PREMIUM_BLOCK_COUNT) would otherwise land any
    // block gated by a means the counts can't see into the free bucket.
    const free = MARKETING_BLOCK_SLUGS.filter((s) => !MARKETING_PREMIUM_BLOCKS.has(s))
    expect(free).not.toContain('customSection')
    expect(free).toHaveLength(FREE_BLOCK_COUNT)
  })

  it('theme count excludes the built-in default', () => {
    expect(THEME_COUNT).toBe(TEMPLATE_COUNT - 1)
    expect(THEME_COUNT).toBeGreaterThan(0)
  })

  it('template count is the full picker catalogue', () => {
    expect(TEMPLATE_COUNT).toBe(themeCatalog.length)
  })

  it('counts a premium variant for every gated block/variant pair', () => {
    expect(PREMIUM_VARIANT_COUNT).toBeGreaterThan(0)
  })

  it('every named block example maps to a real registered block', () => {
    // Copy that names blocks must not invent them. Match loosely — the copy
    // uses plain-English plurals ("split heroes") against config slugs
    // ("splitHero") — but every example must resolve to something registered.
    // Against the marketing-visible set, not the raw registry: copy must not
    // name a block it is not allowed to count.
    const slugs = MARKETING_BLOCK_SLUGS.map((s) => s.toLowerCase())
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
    const aliases: Record<string, string> = {
      splitheroes: 'splithero',
      productgrids: 'productgrid',
      editoriallayouts: 'richtext',
      galleries: 'imagegallery',
      reviews: 'reviews',
      tickers: 'ticker',
      faqs: 'faq',
      steps: 'steps',
      testimonials: 'testimonials',
      contactforms: 'contact',
    }
    for (const example of BLOCK_EXAMPLES) {
      const target = aliases[normalise(example)]
      expect(target, `no alias mapped for copy example "${example}"`).toBeDefined()
      expect(slugs, `copy names "${example}" but no block "${target}" is registered`).toContain(
        target,
      )
    }
  })
})

/**
 * The premium upsell is the newest thing on /features, and its examples are the
 * soft spot: a count cannot drift from its registry, but a hand-written layout
 * name can. A plausible-sounding layout is exactly the phantom-feature failure
 * CLAUDE.md warns about, so every named variant must resolve to a gated pair.
 */
describe('premium block and variant copy', () => {
  it('every named variant example is a real gated blockType/variant pair', () => {
    for (const ex of PREMIUM_VARIANT_EXAMPLES) {
      expect(
        isPremiumVariant(ex.blockType, ex.variant),
        `copy says "${ex.label}" but ${ex.blockType}.${ex.variant} is not gated`,
      ).toBe(true)
    }
  })

  it('never names more examples than there are premium variants', () => {
    expect(PREMIUM_VARIANT_EXAMPLES.length).toBeLessThanOrEqual(PREMIUM_VARIANT_COUNT)
  })

  it('names exactly the block types gated at render (PREMIUM_BLOCK_TYPES)', () => {
    // PREMIUM_BLOCK_NAMES is about render-time gating specifically — the copy
    // reads "this block requires Premium to place at all". PREMIUM_BLOCK_COUNT
    // is broader: it also includes save-gated blocks like customSection, which
    // this list must NOT name, because a Free tenant can still place an
    // existing customSection instance — only creating a new definition is
    // Premium-gated.
    expect(PREMIUM_BLOCK_NAMES).toHaveLength(PREMIUM_BLOCK_TYPES.size)
    expect(PREMIUM_BLOCK_NAMES).toContain('Split Hero (legacy — use Hero)')
    expect(PREMIUM_BLOCK_NAMES.join(' ')).not.toMatch(/section/i)
  })

  it('PREMIUM_BLOCK_COUNT is broader than PREMIUM_BLOCK_TYPES, by design', () => {
    expect(PREMIUM_BLOCK_COUNT).toBeGreaterThan(PREMIUM_BLOCK_TYPES.size)
  })

  it('drops the admin-only "(Pro)" suffix from the registry label', () => {
    // The block picker flags the gate in its label; the site says premium in
    // prose, so shipping "Split Hero (Pro)" into a sentence would read as a typo.
    for (const name of PREMIUM_BLOCK_NAMES) expect(name).not.toMatch(/\(pro\)/i)
  })

  it('counts blocks-with-variants separately from variants', () => {
    // One premium variant per block today. Copy must not assume that stays true.
    expect(PREMIUM_VARIANT_COUNT).toBeGreaterThanOrEqual(PREMIUM_VARIANT_BLOCK_COUNT)
  })
})

describe('layout variant range', () => {
  it('reports a real range, never a flat "each block has N"', () => {
    // /templates said "Each ships with 4 layout variants" while the spread was
    // 2–4 and most blocks had fewer.
    expect(MIN_VARIANTS_PER_BLOCK).toBeGreaterThan(0)
    expect(MAX_VARIANTS_PER_BLOCK).toBeGreaterThanOrEqual(MIN_VARIANTS_PER_BLOCK)
  })

  it('counts only blocks that actually offer a variant select', () => {
    expect(BLOCKS_WITH_VARIANTS).toBeGreaterThan(0)
    expect(BLOCKS_WITH_VARIANTS).toBeLessThanOrEqual(BLOCK_COUNT)

    const withVariantField = PAGE_BLOCKS.filter(
      (b) =>
        MARKETING_BLOCK_SLUGS.includes(b.slug) &&
        b.fields.some((f) => 'name' in f && f.name === 'variant'),
    ).length
    expect(BLOCKS_WITH_VARIANTS).toBe(withVariantField)
  })
})
