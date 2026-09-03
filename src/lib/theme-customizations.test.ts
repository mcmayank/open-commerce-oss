import { describe, expect, it } from 'vitest'
import type { ThemeMeta } from '@/themes/types'
import { sanitizeThemeCustomizations } from './theme-customizations'

const editorial: ThemeMeta = {
  slug: 'editorial',
  label: 'Editorial',
  entitlement: 'free',
  fields: [
    { name: 'headline', type: 'text', label: 'Headline', maxLength: 10 },
    { name: 'accent', type: 'color', label: 'Accent' },
    { name: 'layout', type: 'select', label: 'Layout', options: [
      { label: 'One', value: 'one' },
      { label: 'Two', value: 'two' },
    ] },
    { name: 'hero', type: 'media', label: 'Hero' },
    { name: 'show', type: 'boolean', label: 'Show' },
    { name: 'cols', type: 'number', label: 'Cols', min: 1, max: 3 },
  ],
}
const other: ThemeMeta = {
  slug: 'other',
  label: 'Other',
  entitlement: 'free',
  fields: [{ name: 'title', type: 'text', label: 'Title' }],
}

const resolve = (slug: string): ThemeMeta | null =>
  slug === 'editorial' ? editorial : slug === 'other' ? other : null

describe('sanitizeThemeCustomizations', () => {
  it('returns an empty object for null/undefined/non-object input', () => {
    expect(sanitizeThemeCustomizations(null, resolve)).toEqual({})
    expect(sanitizeThemeCustomizations(undefined, resolve)).toEqual({})
    expect(sanitizeThemeCustomizations('nope', resolve)).toEqual({})
  })

  it('drops entries for theme slugs not in the catalog', () => {
    const out = sanitizeThemeCustomizations({ 'no-such-theme': { headline: 'x' } }, resolve)
    expect(out).toEqual({})
  })

  it('drops fields the theme did not declare', () => {
    const out = sanitizeThemeCustomizations({ editorial: { headline: 'Hi', bogus: 'x' } }, resolve)
    expect(out.editorial).toEqual({ headline: 'Hi' })
  })

  it('keeps valid values, coercing where the schema allows', () => {
    const out = sanitizeThemeCustomizations(
      {
        editorial: {
          headline: 'A very long headline',
          accent: '#00ff00',
          layout: 'two',
          hero: 'media-1',
          show: true,
          cols: 9,
        },
      },
      resolve,
    )
    expect(out.editorial).toEqual({
      headline: 'A very lon', // truncated to maxLength 10
      accent: '#00ff00',
      layout: 'two',
      hero: 'media-1',
      show: true,
      cols: 3, // clamped to max
    })
  })

  it('drops invalid provided values rather than persisting them (empty entry omitted)', () => {
    const out = sanitizeThemeCustomizations(
      {
        editorial: {
          accent: 'red', // not hex
          layout: 'grid', // not an option
          hero: '', // empty id
          show: 'yes', // not a boolean
          cols: 'many', // not a number
        },
      },
      resolve,
    )
    expect(out).toEqual({}) // no valid values → slug omitted entirely
  })

  it('does NOT fill defaults for unprovided fields (defaults stay dynamic at read time)', () => {
    const out = sanitizeThemeCustomizations({ editorial: { headline: 'Hi' } }, resolve)
    expect(out.editorial).toEqual({ headline: 'Hi' })
  })

  it('keeps each theme slug isolated', () => {
    const out = sanitizeThemeCustomizations(
      { editorial: { headline: 'Hi' }, other: { title: 'Yo' } },
      resolve,
    )
    expect(out).toEqual({ editorial: { headline: 'Hi' }, other: { title: 'Yo' } })
  })

  it('throws when the serialized result exceeds the size cap', () => {
    const big: ThemeMeta = {
      slug: 'big',
      label: 'Big',
      entitlement: 'free',
      fields: [{ name: 'blob', type: 'text', label: 'Blob' }], // no maxLength
    }
    const resolveBig = (slug: string) => (slug === 'big' ? big : null)
    expect(() =>
      sanitizeThemeCustomizations({ big: { blob: 'x'.repeat(20_000) } }, resolveBig),
    ).toThrow(/too large/i)
  })
})
