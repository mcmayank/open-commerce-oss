import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  getControlValue,
  setControlValue,
  asBlockStyleMap,
  setBlockStyleInMap,
  STYLABLE_BLOCK_TYPES,
  styleGroupsFor,
} from './panel'
import { scanBlockStyleParts } from './scan-parts'
import type { BlockStyle } from './vocabulary'

describe('getControlValue', () => {
  it('reads a set control', () => {
    const style: BlockStyle = { heading: { size: 'xl' } }
    expect(getControlValue(style, 'heading', 'size')).toBe('xl')
  })

  it('returns undefined for an unset control', () => {
    const style: BlockStyle = { heading: { size: 'xl' } }
    expect(getControlValue(style, 'heading', 'weight')).toBeUndefined()
  })

  it('returns undefined when the whole group is absent', () => {
    expect(getControlValue({}, 'eyebrow', 'treatment')).toBeUndefined()
  })
})

describe('setControlValue', () => {
  it('sets a control on an empty style', () => {
    const next = setControlValue({}, 'heading', 'size', 'xl')
    expect(next).toEqual({ heading: { size: 'xl' } })
  })

  it('adds a control alongside an existing one in the same group', () => {
    const style: BlockStyle = { heading: { size: 'xl' } }
    const next = setControlValue(style, 'heading', 'weight', '700')
    expect(next).toEqual({ heading: { size: 'xl', weight: '700' } })
  })

  it('does not mutate the input style', () => {
    const style: BlockStyle = { heading: { size: 'xl' } }
    setControlValue(style, 'heading', 'weight', '700')
    expect(style).toEqual({ heading: { size: 'xl' } })
  })

  it('clears a single control back to "Default" (undefined value)', () => {
    const style: BlockStyle = { heading: { size: 'xl', weight: '700' } }
    const next = setControlValue(style, 'heading', 'weight', undefined)
    expect(next).toEqual({ heading: { size: 'xl' } })
  })

  it('treats an empty-string value the same as undefined (drops the control)', () => {
    const style: BlockStyle = { heading: { size: 'xl' } }
    const next = setControlValue(style, 'heading', 'size', '')
    expect(next).toEqual({})
  })

  it('drops the whole group once its last control is cleared, rather than leaving {}', () => {
    const style: BlockStyle = { heading: { size: 'xl' } }
    const next = setControlValue(style, 'heading', 'size', undefined)
    expect(next).toEqual({})
    expect('heading' in next).toBe(false)
  })

  it('leaves other groups untouched', () => {
    const style: BlockStyle = { heading: { size: 'xl' }, media: { radius: 'lg' } }
    const next = setControlValue(style, 'heading', 'size', undefined)
    expect(next).toEqual({ media: { radius: 'lg' } })
  })
})

describe('asBlockStyleMap', () => {
  it('passes through a plain object', () => {
    const map = { abc: { heading: { size: 'xl' } } }
    expect(asBlockStyleMap(map)).toBe(map)
  })

  it('treats null/undefined as an empty map', () => {
    expect(asBlockStyleMap(null)).toEqual({})
    expect(asBlockStyleMap(undefined)).toEqual({})
  })

  it('treats an array or primitive as an empty map (malformed json column)', () => {
    expect(asBlockStyleMap([1, 2, 3])).toEqual({})
    expect(asBlockStyleMap('oops')).toEqual({})
    expect(asBlockStyleMap(42)).toEqual({})
  })
})

describe('setBlockStyleInMap', () => {
  it('adds a new block entry', () => {
    const next = setBlockStyleInMap({}, 'block-1', { heading: { size: 'xl' } })
    expect(next).toEqual({ 'block-1': { heading: { size: 'xl' } } })
  })

  it('replaces an existing entry without touching other blocks', () => {
    const map: Record<string, BlockStyle> = {
      'block-1': { heading: { size: 'xl' } },
      'block-2': { media: { radius: 'sm' } },
    }
    const next = setBlockStyleInMap(map, 'block-1', { heading: { size: 'lg' } })
    expect(next).toEqual({ 'block-1': { heading: { size: 'lg' } }, 'block-2': { media: { radius: 'sm' } } })
  })

  it('removes the entry once the style is empty', () => {
    const map: Record<string, BlockStyle> = { 'block-1': { heading: { size: 'xl' } } }
    const next = setBlockStyleInMap(map, 'block-1', {})
    expect(next).toEqual({})
  })

  it('does not mutate the input map', () => {
    const map: Record<string, BlockStyle> = { 'block-1': { heading: { size: 'xl' } } }
    setBlockStyleInMap(map, 'block-1', {})
    expect(map).toEqual({ 'block-1': { heading: { size: 'xl' } } })
  })

  it('works equally when the key is a blockType rather than a block id (store-wide defaults)', () => {
    const next = setBlockStyleInMap({}, 'hero', { heading: { size: 'xl' } })
    expect(next).toEqual({ hero: { heading: { size: 'xl' } } })
  })
})

describe('STYLABLE_BLOCK_TYPES', () => {
  it('is non-empty and includes hero, the only block wired to consume the vocabulary so far', () => {
    expect(STYLABLE_BLOCK_TYPES.length).toBeGreaterThan(0)
    expect(STYLABLE_BLOCK_TYPES.some((t) => t.value === 'hero')).toBe(true)
  })

  it('includes productGrid, wired to the vocabulary in Task 2 of Phase 3a', () => {
    expect(STYLABLE_BLOCK_TYPES.map((t) => t.value)).toContain('productGrid')
  })

  it('includes categoryPreviews, wired to the vocabulary in Task 3 of Phase 3a', () => {
    expect(STYLABLE_BLOCK_TYPES.map((t) => t.value)).toContain('categoryPreviews')
  })

  it('includes ctaBanner, wired to the vocabulary in Task 4 of Phase 3a', () => {
    expect(STYLABLE_BLOCK_TYPES.map((t) => t.value)).toContain('ctaBanner')
  })

  it('includes richText, wired to the vocabulary in Task 5 of Phase 3a', () => {
    expect(STYLABLE_BLOCK_TYPES.map((t) => t.value)).toContain('richText')
  })

  it('includes contact, featuredProduct, videoEmbed, and newsletterSignup, wired in Phase 3b batch 1', () => {
    const values = STYLABLE_BLOCK_TYPES.map((t) => t.value)
    expect(values).toContain('contact')
    expect(values).toContain('featuredProduct')
    expect(values).toContain('videoEmbed')
    expect(values).toContain('newsletterSignup')
  })

  it('includes promoSection, storyStats, faq, and featureGrid, wired in Phase 3b batch 2', () => {
    const values = STYLABLE_BLOCK_TYPES.map((t) => t.value)
    expect(values).toContain('promoSection')
    expect(values).toContain('storyStats')
    expect(values).toContain('faq')
    expect(values).toContain('featureGrid')
  })

  it('includes incentives, reviews, steps, and testimonials, wired in Phase 3b batch 3', () => {
    const values = STYLABLE_BLOCK_TYPES.map((t) => t.value)
    expect(values).toContain('incentives')
    expect(values).toContain('reviews')
    expect(values).toContain('steps')
    expect(values).toContain('testimonials')
  })

  it('includes logoStrip, imageGallery, and ticker, wired in Phase 3b batch 4; spacer is deliberately excluded', () => {
    const values = STYLABLE_BLOCK_TYPES.map((t) => t.value)
    expect(values).toContain('logoStrip')
    expect(values).toContain('imageGallery')
    expect(values).toContain('ticker')
    expect(values).not.toContain('spacer')
  })

  it('every entry has a non-empty value and label', () => {
    for (const entry of STYLABLE_BLOCK_TYPES) {
      expect(entry.value.length).toBeGreaterThan(0)
      expect(entry.label.length).toBeGreaterThan(0)
    }
  })
})

/**
 * blockType slug -> src/blocks directory name. Almost every slug is just the
 * directory lower-cased at the first letter; these two are not, because the
 * directory uses an initialism.
 */
const DIR_OVERRIDES: Record<string, string> = {
  ctaBanner: 'CTABanner',
  faq: 'FAQ',
}

function dirFor(slug: string): string {
  return DIR_OVERRIDES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

describe('STYLABLE_BLOCK_TYPES parts', () => {
  const scanned = scanBlockStyleParts(path.resolve(__dirname, '../../blocks'))

  it('declares parts matching what each block actually reads', () => {
    const drift: string[] = []
    for (const entry of STYLABLE_BLOCK_TYPES) {
      const actual = scanned.get(dirFor(entry.value))
      // Presence guard: an unmatched directory would make the comparison below
      // compare undefined to undefined and pass vacuously.
      expect(actual, `no block directory found for "${entry.value}"`).toBeDefined()
      const declared = [...entry.parts].sort()
      if (JSON.stringify(declared) !== JSON.stringify(actual)) {
        drift.push(`${entry.value}: declared [${declared}] but reads [${actual}]`)
      }
    }
    expect(drift).toEqual([])
  })

  it('never declares a part outside the vocabulary', () => {
    const valid = ['eyebrow', 'heading', 'subheading', 'accent', 'media', 'section']
    for (const entry of STYLABLE_BLOCK_TYPES) {
      expect(entry.parts.length).toBeGreaterThan(0)
      for (const part of entry.parts) expect(valid).toContain(part)
    }
  })
})

describe('styleGroupsFor', () => {
  it('returns only the groups a block reads', () => {
    expect(styleGroupsFor('logoStrip')).toEqual(['section'])
  })

  it('returns every group for Hero', () => {
    expect(styleGroupsFor('hero')).toHaveLength(6)
  })

  it('returns nothing for a block that is not stylable, so the panel renders no controls', () => {
    expect(styleGroupsFor('spacer')).toEqual([])
    expect(styleGroupsFor(undefined)).toEqual([])
  })
})
