import { describe, expect, it, vi } from 'vitest'

// The real theme modules pull in server components (fonts, next/image, payload
// config); the registry test only cares about slug resolution.
vi.mock('./sd-bakery', () => ({ sdBakeryTheme: { slug: 'sd-bakery' } }))
vi.mock('./editorial', () => ({ editorialTheme: { slug: 'editorial' } }))

import { getStorefrontTheme, getStorefrontThemeBySlug } from './index'

describe('getStorefrontTheme', () => {
  it('returns null for the default theme', () => {
    expect(getStorefrontTheme({ storefrontTheme: 'default' })).toBeNull()
  })

  it('returns null when the field is missing (legacy rows)', () => {
    expect(getStorefrontTheme({})).toBeNull()
    expect(getStorefrontTheme({ storefrontTheme: null })).toBeNull()
  })

  it('returns null for unknown theme slugs', () => {
    expect(
      getStorefrontTheme({ storefrontTheme: 'no-such-theme' as unknown as 'default' }),
    ).toBeNull()
  })

  it('resolves the sd-bakery theme', () => {
    const theme = getStorefrontTheme({ storefrontTheme: 'sd-bakery' })
    expect(theme).not.toBeNull()
    expect(theme?.slug).toBe('sd-bakery')
  })
})

describe('getStorefrontThemeBySlug', () => {
  it('returns null for the default slug and unknown/empty slugs', () => {
    expect(getStorefrontThemeBySlug('default')).toBeNull()
    expect(getStorefrontThemeBySlug(null)).toBeNull()
    expect(getStorefrontThemeBySlug(undefined)).toBeNull()
    expect(getStorefrontThemeBySlug('no-such-theme')).toBeNull()
  })

  it('resolves a registered theme directly by slug (used by preview)', () => {
    expect(getStorefrontThemeBySlug('sd-bakery')?.slug).toBe('sd-bakery')
    expect(getStorefrontThemeBySlug('editorial')?.slug).toBe('editorial')
  })
})
