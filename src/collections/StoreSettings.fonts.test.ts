import { beforeEach, describe, expect, it } from 'vitest'
import { resolveThemeFonts } from './StoreSettings'
import { __resetCatalogCacheForTests } from '@/lib/fonts/catalog'

const theme = (t: Record<string, unknown>) => ({ theme: t })

describe('resolveThemeFonts', () => {
  beforeEach(() => {
    delete process.env.GOOGLE_FONTS_API_KEY
    __resetCatalogCacheForTests()
  })

  it('accepts a catalog family and writes the axes snapshot beside it', async () => {
    const data = theme({ fontFamily: 'Inter' })
    await resolveThemeFonts(data)
    expect(data.theme.fontFamily).toBe('Inter')
    expect(data.theme.fontFamilyAxes).toMatchObject({ category: 'sans-serif', variable: true })
  })

  it('resolves the heading slot independently of the body slot', async () => {
    const data = theme({ fontFamily: 'Inter', headingFont: 'Merriweather' })
    await resolveThemeFonts(data)
    expect(data.theme.headingFont).toBe('Merriweather')
    expect(data.theme.headingFontAxes).toMatchObject({ category: 'serif' })
    expect(data.theme.fontFamilyAxes).toMatchObject({ category: 'sans-serif' })
  })

  it('accepts the system sentinel and clears the axes snapshot', async () => {
    const data = theme({ fontFamily: 'system', fontFamilyAxes: { category: 'serif' } })
    await resolveThemeFonts(data)
    expect(data.theme.fontFamily).toBe('system')
    expect(data.theme.fontFamilyAxes).toBeNull()
  })

  it('clears the axes snapshot when the merchant reverts to inherit', async () => {
    const data = theme({ fontFamily: '', fontFamilyAxes: { category: 'serif' } })
    await resolveThemeFonts(data)
    expect(data.theme.fontFamily).toBeNull()
    expect(data.theme.fontFamilyAxes).toBeNull()
  })

  it('leaves a stored font untouched when the update does not mention it', async () => {
    // The critical partial-update case: a merchant changing only their primary
    // colour submits a theme object with no font keys at all. Resolving an
    // absent key would write null over their chosen font and silently strip
    // the storefront's <link> — the exact bug this guard exists to prevent.
    const data = theme({ primaryColor: '#ff0000' })
    await resolveThemeFonts(data)
    expect('fontFamily' in data.theme).toBe(false)
    expect('fontFamilyAxes' in data.theme).toBe(false)
  })

  it('resolves the body slot without disturbing an unmentioned heading slot', async () => {
    const data = theme({ fontFamily: 'Inter' })
    await resolveThemeFonts(data)
    expect(data.theme.fontFamily).toBe('Inter')
    expect('headingFont' in data.theme).toBe(false)
    expect('headingFontAxes' in data.theme).toBe(false)
  })

  it('is a no-op on a document with no theme group', async () => {
    const data = { storeName: 'Shop' }
    await expect(resolveThemeFonts(data)).resolves.toBe(data)
  })

  it('rejects a family that is not in the catalog', async () => {
    await expect(
      resolveThemeFonts(theme({ fontFamily: 'Definitely Not A Real Font' })),
    ).rejects.toThrow(/not a Google Font/i)
  })

  it('rejects a CSS injection payload written directly through the API', async () => {
    await expect(
      resolveThemeFonts(theme({ fontFamily: 'Inter"; } body { display: none } /*' })),
    ).rejects.toThrow(/not a Google Font/i)
  })

  it('rejects an injection payload in the heading slot too', async () => {
    // Positive control for slot coverage: a hook that only guarded the body
    // slot would pass every test above.
    await expect(
      resolveThemeFonts(theme({ headingFont: 'Lora&text=leak' })),
    ).rejects.toThrow(/not a Google Font/i)
  })

  // Fix round 1: Payload's field-level beforeValidate backfills any field the
  // merchant didn't submit with its stored value before this collection-level
  // hook runs, so `fontFamily in theme` is true even on a save that only
  // touched primaryColor. Without comparing against originalDoc, this
  // re-resolves — and therefore re-validates against the live catalog — a
  // family the merchant isn't touching at all.
  it('the load-bearing case: leaves a stale/unavailable family alone when only an unrelated field changed', async () => {
    const originalDoc = theme({ fontFamily: 'Some Family No Longer In The Catalog' })
    // Simulates what Payload actually hands the hook after its own backfill:
    // the unchanged font value merged back in, plus the field the merchant
    // really edited.
    const data = theme({
      fontFamily: 'Some Family No Longer In The Catalog',
      primaryColor: '#ff0000',
    })
    await expect(resolveThemeFonts(data, originalDoc)).resolves.toBe(data)
    expect(data.theme.fontFamily).toBe('Some Family No Longer In The Catalog')
  })

  // Positive control for the case above — without it, a hook that skipped
  // every slot unconditionally would also pass the load-bearing test.
  it('still resolves a slot whose value genuinely changed', async () => {
    const originalDoc = theme({ fontFamily: 'Inter' })
    const data = theme({ fontFamily: 'Merriweather' })
    await resolveThemeFonts(data, originalDoc)
    expect(data.theme.fontFamily).toBe('Merriweather')
    expect(data.theme.fontFamilyAxes).toMatchObject({ category: 'serif' })
  })

  it('still nulls both family and axes when a set font is explicitly cleared to inherit', async () => {
    const originalDoc = theme({ fontFamily: 'Inter', fontFamilyAxes: { category: 'sans-serif' } })
    const data = theme({ fontFamily: '' })
    await resolveThemeFonts(data, originalDoc)
    expect(data.theme.fontFamily).toBeNull()
    expect(data.theme.fontFamilyAxes).toBeNull()
  })

  it('a create (no originalDoc) still resolves and still rejects an unknown family', async () => {
    const data = theme({ fontFamily: 'Inter' })
    await resolveThemeFonts(data, undefined)
    expect(data.theme.fontFamily).toBe('Inter')
    expect(data.theme.fontFamilyAxes).toMatchObject({ category: 'sans-serif' })

    await expect(
      resolveThemeFonts(theme({ fontFamily: 'Definitely Not A Real Font' }), undefined),
    ).rejects.toThrow(/not a Google Font/i)
  })
})
