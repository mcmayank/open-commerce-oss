import { beforeEach, describe, expect, it } from 'vitest'
import { SYSTEM_FONT_VALUE, resolveFamily } from './validate'
import { __resetCatalogCacheForTests } from './catalog'

describe('resolveFamily', () => {
  beforeEach(() => {
    delete process.env.GOOGLE_FONTS_API_KEY
    __resetCatalogCacheForTests()
  })

  it('accepts an exact family name from the catalog and returns its axes', async () => {
    const result = await resolveFamily('Inter')
    expect(result.family).toBe('Inter')
    expect(result.axes).not.toBeNull()
    expect(result.axes?.category).toBe('sans-serif')
  })

  it('accepts the system sentinel without a catalog lookup', async () => {
    const result = await resolveFamily(SYSTEM_FONT_VALUE)
    expect(result.family).toBe(SYSTEM_FONT_VALUE)
    expect(result.axes).toBeNull()
  })

  it('treats empty string, null and undefined as inherit', async () => {
    for (const raw of ['', null, undefined]) {
      const result = await resolveFamily(raw)
      expect(result.family).toBeNull()
      expect(result.axes).toBeNull()
    }
  })

  it('rejects a family that is not in the catalog', async () => {
    await expect(resolveFamily('Definitely Not A Real Font')).rejects.toThrow(/not a Google Font/i)
  })

  it('rejects a CSS injection payload', async () => {
    await expect(
      resolveFamily('Inter"; } body { display: none } /*'),
    ).rejects.toThrow(/not a Google Font/i)
  })

  it('rejects a URL parameter injection payload', async () => {
    await expect(resolveFamily('Inter&text=leak')).rejects.toThrow(/not a Google Font/i)
  })

  it('rejects a case-mismatched name rather than silently correcting it', async () => {
    // The stored value is what the URL builder emits verbatim, so accepting
    // "inter" would produce a family param Google does not recognise.
    await expect(resolveFamily('inter')).rejects.toThrow(/not a Google Font/i)
  })

  it('rejects a non-string value', async () => {
    await expect(resolveFamily({ family: 'Inter' })).rejects.toThrow(/not a Google Font/i)
  })
})
