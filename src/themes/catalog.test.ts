import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_SLUG, getThemeMeta, themeCatalog, themeSelectOptions } from './catalog'

describe('theme catalog', () => {
  it('includes a free, field-less Default entry', () => {
    const def = getThemeMeta(DEFAULT_THEME_SLUG)
    expect(def).not.toBeNull()
    expect(def?.entitlement).toBe('free')
    expect(def?.fields).toEqual([])
  })

  it('carries the sd-bakery entry as premium', () => {
    expect(getThemeMeta('sd-bakery')?.entitlement).toBe('premium')
  })

  it('carries the editorial entry as a free template with customizable fields', () => {
    const editorial = getThemeMeta('editorial')
    expect(editorial?.entitlement).toBe('free')
    expect(editorial?.fields.length).toBeGreaterThan(0)
  })

  it('returns null for unknown or missing slugs', () => {
    expect(getThemeMeta('no-such-theme')).toBeNull()
    expect(getThemeMeta(null)).toBeNull()
    expect(getThemeMeta(undefined)).toBeNull()
  })
})

describe('themeSelectOptions', () => {
  it('maps every catalog entry to a { label, value: slug } option', () => {
    const options = themeSelectOptions()
    expect(options.length).toBe(themeCatalog.length)
    const values = options.map((o) => o.value)
    expect(values).toContain('default')
    expect(values).toContain('sd-bakery')
  })

  it('flags premium templates in the option label', () => {
    const bakery = themeSelectOptions().find((o) => o.value === 'sd-bakery')
    expect(bakery?.label).toMatch(/premium/i)
  })
})
