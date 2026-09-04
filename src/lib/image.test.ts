import { describe, expect, it } from 'vitest'
import { mediaDimensions, mediaSrc, mediaSrcSet } from './image'

/**
 * These feed every storefront `<img>`. The failure that matters most is not a
 * wrong srcset — it is returning something unusable for media that predates
 * ingest processing, because that would blank images on every existing store.
 */

/** A doc as it looks after ingest processing: main file plus three variants. */
const processed = {
  url: '/api/media/file/croissant.webp',
  width: 1086,
  height: 1448,
  sizes: {
    thumb: { url: '/api/media/file/croissant-400x533.webp', width: 400 },
    card: { url: '/api/media/file/croissant-800x1066.webp', width: 800 },
    hero: { url: '/api/media/file/croissant-1086x1448.webp', width: 1086 },
  },
}

/** A doc uploaded before ingest processing: no variants at all. */
const legacy = { url: '/api/media/file/old.png', width: 2000, height: 1500 }

describe('mediaSrcSet', () => {
  it('emits every variant plus the main file, ascending by width', () => {
    expect(mediaSrcSet(processed)).toBe(
      '/api/media/file/croissant-400x533.webp 400w, ' +
        '/api/media/file/croissant-800x1066.webp 800w, ' +
        '/api/media/file/croissant-1086x1448.webp 1086w',
    )
  })

  it('de-duplicates widths', () => {
    // `withoutEnlargement` means a variant can land at the source width — here
    // hero is 1086 and so is the main file. Two candidates at one width is a
    // malformed srcset, so the main file is dropped rather than repeated.
    const set = mediaSrcSet(processed) ?? ''
    expect(set.match(/1086w/g)).toHaveLength(1)
  })

  it('returns undefined for media with no variants, so call sites fall back to src', () => {
    // Every image on every existing store is in this state until the Task 5
    // backfill runs. Returning a bogus srcset here would break all of them.
    expect(mediaSrcSet(legacy)).toBeUndefined()
    expect(mediaSrcSet({ ...legacy, sizes: {} })).toBeUndefined()
    expect(mediaSrcSet({ ...legacy, sizes: null })).toBeUndefined()
  })

  it('returns undefined for a bare id, a string, null or undefined', () => {
    // Blocks populate media at varying depth; an unpopulated relationship is an
    // id, not a doc.
    expect(mediaSrcSet(42)).toBeUndefined()
    expect(mediaSrcSet('/some/url.png')).toBeUndefined()
    expect(mediaSrcSet(null)).toBeUndefined()
    expect(mediaSrcSet(undefined)).toBeUndefined()
  })

  it('skips variants missing a url or a width', () => {
    expect(
      mediaSrcSet({
        url: '/m.webp',
        width: 900,
        sizes: {
          thumb: { url: '/t.webp', width: 400 },
          card: { url: '/c.webp' },
          hero: { width: 800 },
        },
      }),
    ).toBe('/t.webp 400w, /m.webp 900w')
  })

  it('omits the main file when it has no width to advertise', () => {
    expect(mediaSrcSet({ url: '/m.webp', sizes: { thumb: { url: '/t.webp', width: 400 } } })).toBe(
      '/t.webp 400w',
    )
  })

  it('coerces the string numerics Postgres returns', () => {
    expect(
      mediaSrcSet({
        url: '/m.webp',
        width: '900' as unknown as number,
        sizes: { thumb: { url: '/t.webp', width: '400' as unknown as number } },
      }),
    ).toBe('/t.webp 400w, /m.webp 900w')
  })
})

describe('mediaSrc', () => {
  it('uses the main file when present', () => {
    expect(mediaSrc(processed)).toBe('/api/media/file/croissant.webp')
    expect(mediaSrc(legacy)).toBe('/api/media/file/old.png')
  })

  it('falls back to the widest variant when the main url is missing', () => {
    expect(
      mediaSrc({
        sizes: {
          thumb: { url: '/t.webp', width: 400 },
          hero: { url: '/h.webp', width: 1600 },
          card: { url: '/c.webp', width: 800 },
        },
      }),
    ).toBe('/h.webp')
  })

  it('returns undefined when there is nothing to show', () => {
    expect(mediaSrc(42)).toBeUndefined()
    expect(mediaSrc(null)).toBeUndefined()
    expect(mediaSrc({})).toBeUndefined()
    expect(mediaSrc({ sizes: { thumb: { width: 400 } } })).toBeUndefined()
  })
})

describe('mediaDimensions', () => {
  it('returns the main file dimensions for the width/height attributes', () => {
    // Only the ratio matters to the browser, and every variant shares it because
    // sizes set width only.
    expect(mediaDimensions(processed)).toEqual({ width: 1086, height: 1448 })
  })

  it('returns undefined rather than a half-known box', () => {
    // A width with no height is worse than nothing: it would let a caller emit
    // one attribute and still shift the layout.
    expect(mediaDimensions({ url: '/m.webp', width: 900 })).toBeUndefined()
    expect(mediaDimensions({ url: '/m.webp', height: 900 })).toBeUndefined()
    expect(mediaDimensions(42)).toBeUndefined()
    expect(mediaDimensions(null)).toBeUndefined()
  })
})
