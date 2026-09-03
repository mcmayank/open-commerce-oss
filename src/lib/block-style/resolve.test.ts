// src/lib/block-style/resolve.test.ts
import { describe, it, expect } from 'vitest'
import { resolveBlockStyle } from './resolve'
import type { BlockStyle } from './vocabulary'

describe('resolveBlockStyle', () => {
  it('returns {} when both layers are empty', () => {
    expect(resolveBlockStyle('hero', 'block-1', {}, {})).toEqual({})
  })

  it('applies store-wide defaults for the blockType when no instance override exists', () => {
    const storeDefaults: Record<string, BlockStyle> = {
      hero: { heading: { weight: '700' } },
    }
    const vars = resolveBlockStyle('hero', 'block-1', storeDefaults, {}) as Record<string, string>
    expect(vars['--bs-heading-weight']).toBe('700')
  })

  it('instance style wins over store-wide default for the same field', () => {
    const storeDefaults: Record<string, BlockStyle> = {
      hero: { heading: { weight: '700', size: 'lg' } },
    }
    const instanceStyles: Record<string, BlockStyle> = {
      'block-1': { heading: { weight: '400' } },
    }
    const vars = resolveBlockStyle('hero', 'block-1', storeDefaults, instanceStyles) as Record<string, string>
    // instance wins on weight
    expect(vars['--bs-heading-weight']).toBe('400')
    // store-wide value for a field the instance didn't touch survives (deep merge)
    expect(vars['--bs-heading-size']).toBe('1.375rem')
  })

  it('deep-merges nested groups: instance sets heading.size, store sets heading.weight — both present', () => {
    const storeDefaults: Record<string, BlockStyle> = {
      hero: { heading: { weight: '800' } },
    }
    const instanceStyles: Record<string, BlockStyle> = {
      'block-1': { heading: { size: 'xl' } },
    }
    const vars = resolveBlockStyle('hero', 'block-1', storeDefaults, instanceStyles) as Record<string, string>
    expect(vars['--bs-heading-size']).toBe('clamp(1.5rem, 3vw, 1.875rem)')
    expect(vars['--bs-heading-weight']).toBe('800')
  })

  it('merges across different groups too (eyebrow from store, media from instance)', () => {
    const storeDefaults: Record<string, BlockStyle> = {
      hero: { eyebrow: { treatment: 'plain' } },
    }
    const instanceStyles: Record<string, BlockStyle> = {
      'block-1': { media: { radius: 'full' } },
    }
    const vars = resolveBlockStyle('hero', 'block-1', storeDefaults, instanceStyles) as Record<string, string>
    // 'plain' treatment is a MultiVocabControl — it emits a var bundle, not a single var.
    expect(vars['--bs-eyebrow-treatment-bg']).toBe('transparent')
    expect(vars['--bs-eyebrow-treatment-transform']).toBe('none')
    expect(vars['--bs-media-radius']).toBe('9999px')
  })

  it('unknown blockType is simply absent from storeDefaults, no throw', () => {
    const storeDefaults: Record<string, BlockStyle> = {
      hero: { heading: { weight: '700' } },
    }
    expect(() => resolveBlockStyle('nonexistentType', 'block-1', storeDefaults, {})).not.toThrow()
    expect(resolveBlockStyle('nonexistentType', 'block-1', storeDefaults, {})).toEqual({})
  })

  it('unknown blockId is simply absent from instanceStyles, no throw', () => {
    const instanceStyles: Record<string, BlockStyle> = {
      'block-1': { heading: { weight: '700' } },
    }
    expect(() => resolveBlockStyle('hero', 'nonexistent-id', {}, instanceStyles)).not.toThrow()
    expect(resolveBlockStyle('hero', 'nonexistent-id', {}, instanceStyles)).toEqual({})
  })

  it('is pure and deterministic: same inputs produce equal output, inputs untouched', () => {
    const storeDefaults: Record<string, BlockStyle> = {
      hero: { heading: { weight: '700' } },
    }
    const instanceStyles: Record<string, BlockStyle> = {
      'block-1': { heading: { size: 'xl' } },
    }
    const a = resolveBlockStyle('hero', 'block-1', storeDefaults, instanceStyles)
    const b = resolveBlockStyle('hero', 'block-1', storeDefaults, instanceStyles)
    expect(a).toEqual(b)
    // inputs untouched by the merge
    expect(storeDefaults.hero).toEqual({ heading: { weight: '700' } })
    expect(instanceStyles['block-1']).toEqual({ heading: { size: 'xl' } })
  })
})
