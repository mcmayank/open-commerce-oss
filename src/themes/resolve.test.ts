import { describe, expect, it } from 'vitest'
import type { ThemeMeta } from './types'
import { resolveThemeValues } from './resolve'

const meta = (fields: ThemeMeta['fields']): ThemeMeta => ({
  slug: 'test',
  label: 'Test',
  entitlement: 'free',
  fields,
})

describe('resolveThemeValues', () => {
  it('drops keys not declared by the theme', () => {
    const values = resolveThemeValues(meta([{ name: 'a', type: 'text', label: 'A' }]), {
      a: 'keep',
      b: 'drop',
    })
    expect(values).toEqual({ a: 'keep' })
    expect('b' in values).toBe(false)
  })

  it('applies declared defaults when the stored value is missing', () => {
    const values = resolveThemeValues(
      meta([{ name: 'headline', type: 'text', label: 'Headline', default: 'Welcome' }]),
      {},
    )
    expect(values.headline).toBe('Welcome')
  })

  describe('color', () => {
    const m = meta([{ name: 'accent', type: 'color', label: 'Accent', default: '#b8442d' }])

    it('passes through a valid hex value', () => {
      expect(resolveThemeValues(m, { accent: '#00ff00' }).accent).toBe('#00ff00')
    })

    it('falls back to the default for an invalid hex value', () => {
      expect(resolveThemeValues(m, { accent: 'red' }).accent).toBe('#b8442d')
    })

    it('returns null when neither the value nor the default is valid hex', () => {
      const noDefault = meta([{ name: 'accent', type: 'color', label: 'Accent' }])
      expect(resolveThemeValues(noDefault, { accent: 'nope' }).accent).toBeNull()
    })
  })

  describe('text', () => {
    it('truncates to maxLength', () => {
      const m = meta([{ name: 't', type: 'text', label: 'T', maxLength: 5 }])
      expect(resolveThemeValues(m, { t: 'abcdefgh' }).t).toBe('abcde')
    })

    it('coerces a non-string to the default', () => {
      const m = meta([{ name: 't', type: 'text', label: 'T', default: 'fallback' }])
      expect(resolveThemeValues(m, { t: 42 }).t).toBe('fallback')
    })
  })

  describe('select', () => {
    const m = meta([
      {
        name: 'layout',
        type: 'select',
        label: 'Layout',
        default: 'single',
        options: [
          { label: 'Single', value: 'single' },
          { label: 'Two column', value: 'two-column' },
        ],
      },
    ])

    it('accepts a value that is one of the options', () => {
      expect(resolveThemeValues(m, { layout: 'two-column' }).layout).toBe('two-column')
    })

    it('falls back to the default for a value not in the options', () => {
      expect(resolveThemeValues(m, { layout: 'grid' }).layout).toBe('single')
    })
  })

  describe('media', () => {
    const m = meta([{ name: 'hero', type: 'media', label: 'Hero' }])

    it('keeps a non-empty string id', () => {
      expect(resolveThemeValues(m, { hero: 'media-123' }).hero).toBe('media-123')
    })

    it('returns null for an empty or missing id', () => {
      expect(resolveThemeValues(m, { hero: '' }).hero).toBeNull()
      expect(resolveThemeValues(m, {}).hero).toBeNull()
    })
  })

  describe('boolean', () => {
    const m = meta([{ name: 'show', type: 'boolean', label: 'Show', default: true }])

    it('passes through a real boolean', () => {
      expect(resolveThemeValues(m, { show: false }).show).toBe(false)
    })

    it('uses the default for a non-boolean value', () => {
      expect(resolveThemeValues(m, { show: 'yes' }).show).toBe(true)
    })
  })

  describe('number', () => {
    const m = meta([{ name: 'cols', type: 'number', label: 'Columns', default: 2, min: 1, max: 3 }])

    it('clamps above the max', () => {
      expect(resolveThemeValues(m, { cols: 9 }).cols).toBe(3)
    })

    it('clamps below the min', () => {
      expect(resolveThemeValues(m, { cols: 0 }).cols).toBe(1)
    })

    it('uses the default for a non-numeric value', () => {
      expect(resolveThemeValues(m, { cols: 'many' }).cols).toBe(2)
    })
  })
})
