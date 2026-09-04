import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetCatalogCacheForTests, fetchCatalog, normalizeVariants, toAxes } from './catalog'
import type { CatalogFamily } from './types'

describe('normalizeVariants', () => {
  it('maps Google’s "regular" spelling to 400 and sorts ascending', () => {
    const { weights } = normalizeVariants(['700', 'regular', '300'])
    expect(weights).toEqual(['300', '400', '700'])
  })

  it('folds italics out of weights and records them as a single flag', () => {
    const { weights, hasItalic } = normalizeVariants(['regular', 'italic', '700', '700italic'])
    expect(weights).toEqual(['400', '700'])
    expect(hasItalic).toBe(true)
  })

  it('reports hasItalic false for a family with no italic variant', () => {
    // Positive control for the test above: without this, a normalizer that
    // hardcoded `hasItalic: true` would pass the whole suite.
    const { weights, hasItalic } = normalizeVariants(['regular', '700'])
    expect(weights).toEqual(['400', '700'])
    expect(hasItalic).toBe(false)
  })

  it('does not emit duplicate weights when a weight has both roman and italic', () => {
    const { weights } = normalizeVariants(['700', '700italic'])
    expect(weights).toEqual(['700'])
  })

  it('sorts numerically rather than lexicographically once a 4-digit weight is present', () => {
    // A lexicographic sort would place '1000' before '200' (string comparison
    // of '1' vs '2'), yielding ['1000', '200', '400', '900']. Google's catalog
    // genuinely has 1000-weight families (Nunito, Cairo in snapshot.json), so
    // this path must be exercised, not just assumed correct by 3-digit inputs.
    const { weights } = normalizeVariants(['1000', '200', 'regular', '900'])
    expect(weights).toEqual(['200', '400', '900', '1000'])
  })
})

describe('toAxes', () => {
  const base: CatalogFamily = {
    family: 'Inter',
    category: 'sans-serif',
    weights: ['400', '700'],
    hasItalic: true,
    variable: { min: 100, max: 900 },
    subsets: ['latin'],
  }

  it('produces a variable snapshot carrying the axis range', () => {
    const axes = toAxes(base)
    expect(axes).toEqual({
      category: 'sans-serif',
      hasItalic: true,
      variable: true,
      min: 100,
      max: 900,
    })
  })

  it('produces a static snapshot carrying the discrete weights', () => {
    const axes = toAxes({ ...base, family: 'Lobster', variable: null, weights: ['400'] })
    expect(axes).toEqual({
      category: 'sans-serif',
      hasItalic: true,
      variable: false,
      weights: ['400'],
    })
  })
})

describe('fetchCatalog fallback', () => {
  const realFetch = globalThis.fetch
  const realKey = process.env.GOOGLE_FONTS_API_KEY

  beforeEach(() => {
    __resetCatalogCacheForTests()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    if (realKey === undefined) delete process.env.GOOGLE_FONTS_API_KEY
    else process.env.GOOGLE_FONTS_API_KEY = realKey
    __resetCatalogCacheForTests()
  })

  it('serves the committed snapshot when no API key is configured', async () => {
    delete process.env.GOOGLE_FONTS_API_KEY
    const families = await fetchCatalog()
    // Presence guard first: an empty array would satisfy every `.some()` below
    // vacuously, and an empty snapshot is exactly the failure worth catching.
    expect(families.length).toBeGreaterThan(0)
    // The five legacy families must be resolvable offline — the Task 4 backfill
    // depends on it.
    for (const family of ['Inter', 'Poppins', 'Merriweather', 'Cormorant Garamond', 'Jost']) {
      expect(families.some((f) => f.family === family)).toBe(true)
    }
  })

  it('serves the snapshot when the fetch throws', async () => {
    process.env.GOOGLE_FONTS_API_KEY = 'test-key'
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))
    const families = await fetchCatalog()
    expect(families.length).toBeGreaterThan(0)
  })

  it('serves the snapshot on a non-200 response', async () => {
    process.env.GOOGLE_FONTS_API_KEY = 'test-key'
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response)
    const families = await fetchCatalog()
    expect(families.length).toBeGreaterThan(0)
  })

  it('uses the live catalog when the key is set and the call succeeds', async () => {
    // Positive control: without this, a fetchCatalog that ignored the API
    // entirely and always returned the snapshot would pass every test above.
    process.env.GOOGLE_FONTS_API_KEY = 'test-key'
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            family: 'Zilla Slab',
            category: 'serif',
            variants: ['regular', '700'],
            subsets: ['latin'],
            axes: [],
          },
        ],
      }),
    } as unknown as Response)
    const families = await fetchCatalog()
    expect(families).toHaveLength(1)
    expect(families[0]).toEqual({
      family: 'Zilla Slab',
      category: 'serif',
      weights: ['400', '700'],
      hasItalic: false,
      variable: null,
      subsets: ['latin'],
    })
  })

  it('caches, so a second call in the same window makes no second request', async () => {
    process.env.GOOGLE_FONTS_API_KEY = 'test-key'
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ family: 'Zilla Slab', category: 'serif', variants: ['regular'], subsets: ['latin'] }],
      }),
    } as unknown as Response)
    globalThis.fetch = spy
    await fetchCatalog()
    await fetchCatalog()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('drops a family whose name is not the safe shape, while keeping a well-formed one from the same response', async () => {
    // The dropped family is the actual attack this gate exists for: it would
    // otherwise reach validate.ts's allowlist unmolested and land raw in the
    // CSS sink (`"${family}", ${fallback}`). The kept family is the positive
    // control — without it, a filter that dropped everything would pass this
    // test just as well as a correct one.
    process.env.GOOGLE_FONTS_API_KEY = 'test-key'
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            family: 'Evil", } body { display: none } /*',
            category: 'sans-serif',
            variants: ['regular'],
            subsets: ['latin'],
          },
          { family: 'Zilla Slab', category: 'serif', variants: ['regular', '700'], subsets: ['latin'] },
        ],
      }),
    } as unknown as Response)
    const families = await fetchCatalog()
    expect(families.some((f) => f.family === 'Zilla Slab')).toBe(true)
    expect(families.some((f) => f.family.includes('"'))).toBe(false)
    expect(families).toHaveLength(1)
  })

  it('keeps a family with a legitimate hyphen or digit, so the safe-shape gate is not over-tight', async () => {
    process.env.GOOGLE_FONTS_API_KEY = 'test-key'
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { family: 'Source Serif 4', category: 'serif', variants: ['regular'], subsets: ['latin'] },
          { family: 'Neuton-ish Test', category: 'serif', variants: ['regular'], subsets: ['latin'] },
        ],
      }),
    } as unknown as Response)
    const families = await fetchCatalog()
    expect(families.some((f) => f.family === 'Source Serif 4')).toBe(true)
    expect(families.some((f) => f.family === 'Neuton-ish Test')).toBe(true)
  })

  it('the entire committed snapshot passes the safe-shape gate, so the offline fallback is never silently emptied', async () => {
    delete process.env.GOOGLE_FONTS_API_KEY
    const families = await fetchCatalog()
    const rawSnapshot = (await import('./snapshot.json')).default as { family: string }[]
    // Presence guard: confirms the gate didn't just happen to pass on an empty
    // list, and confirms nothing upstream already shrank the fixture.
    expect(rawSnapshot.length).toBeGreaterThan(0)
    expect(families).toHaveLength(rawSnapshot.length)
  })
})
