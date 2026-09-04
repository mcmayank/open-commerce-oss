import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, logoSizeClass, resolveHeaderLayout, resolveThemeLayout } from './layout'

describe('resolveThemeLayout', () => {
  it('falls back to the standard layout when a theme specifies none', () => {
    expect(resolveThemeLayout(undefined)).toEqual(DEFAULT_LAYOUT)
    expect(resolveThemeLayout(null)).toEqual(DEFAULT_LAYOUT)
    expect(resolveThemeLayout({})).toEqual({ header: 'standard', footer: 'standard' })
  })

  it('applies the theme overrides while defaulting the rest', () => {
    expect(resolveThemeLayout({ header: 'centered' })).toEqual({
      header: 'centered',
      footer: 'standard',
    })
    expect(resolveThemeLayout({ footer: 'minimal' })).toEqual({
      header: 'standard',
      footer: 'minimal',
    })
  })
})

describe('resolveHeaderLayout', () => {
  it('uses the theme default when the setting is unset', () => {
    expect(resolveHeaderLayout('editorial', undefined)).toBe('editorial')
    expect(resolveHeaderLayout('editorial', null)).toBe('editorial')
    expect(resolveHeaderLayout('centered', 'theme')).toBe('centered')
  })

  it('applies the tenant override when set to a real layout', () => {
    expect(resolveHeaderLayout('standard', 'editorial')).toBe('editorial')
    expect(resolveHeaderLayout('editorial', 'standard')).toBe('standard')
    expect(resolveHeaderLayout('standard', 'centered')).toBe('centered')
  })

  it('falls back to the theme default for an unrecognized value', () => {
    expect(resolveHeaderLayout('centered', 'bogus' as never)).toBe('centered')
  })
})

describe('logoSizeClass', () => {
  it('returns the exact class string for each size', () => {
    expect(logoSizeClass('small')).toBe('h-8 md:h-10 w-auto object-contain')
    expect(logoSizeClass('medium')).toBe('h-11 md:h-14 w-auto object-contain')
    expect(logoSizeClass('large')).toBe('h-14 md:h-20 w-auto object-contain')
    expect(logoSizeClass('xlarge')).toBe('h-16 md:h-24 w-auto object-contain')
  })

  it('falls back to medium for unset or unknown values', () => {
    expect(logoSizeClass(null)).toBe('h-11 md:h-14 w-auto object-contain')
    expect(logoSizeClass(undefined)).toBe('h-11 md:h-14 w-auto object-contain')
    expect(logoSizeClass('huge' as never)).toBe('h-11 md:h-14 w-auto object-contain')
  })
})
