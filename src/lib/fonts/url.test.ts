import { describe, expect, it } from 'vitest'
import { GOOGLE_FONTS_CSS2_BASE, buildFontHref } from './url'
import type { FontAxes } from './types'

const variable = (min: number, max: number): FontAxes => ({
  category: 'sans-serif',
  hasItalic: true,
  variable: true,
  min,
  max,
})
const staticAxes = (weights: string[]): FontAxes => ({
  category: 'serif',
  hasItalic: true,
  variable: false,
  weights,
})

describe('buildFontHref', () => {
  it('returns null when there are no Google families to load', () => {
    expect(buildFontHref([])).toBeNull()
  })

  it('requests a single variable range clamped to the family’s real axis', () => {
    const href = buildFontHref([{ family: 'Inter', axes: variable(100, 900) }])
    expect(href).toBe(`${GOOGLE_FONTS_CSS2_BASE}?family=Inter:wght@300..800&display=swap`)
  })

  it('clamps the range up when the family’s axis starts above 300', () => {
    const href = buildFontHref([{ family: 'Playfair Display', axes: variable(400, 900) }])
    expect(href).toBe(
      `${GOOGLE_FONTS_CSS2_BASE}?family=Playfair+Display:wght@400..800&display=swap`,
    )
  })

  it('clamps the range down when the family’s axis ends below 800', () => {
    const href = buildFontHref([{ family: 'Lora', axes: variable(400, 700) }])
    expect(href).toBe(`${GOOGLE_FONTS_CSS2_BASE}?family=Lora:wght@400..700&display=swap`)
  })

  it('collapses a degenerate range to a single weight', () => {
    const href = buildFontHref([{ family: 'Narrow', axes: variable(500, 500) }])
    expect(href).toBe(`${GOOGLE_FONTS_CSS2_BASE}?family=Narrow:wght@500&display=swap`)
  })

  it('keeps at most four static weights, in the fixed 400/700/600/500 priority order', () => {
    // The family offers all six candidate weights, so the priority order is
    // genuinely exercised rather than incidentally satisfied by availability.
    const href = buildFontHref([
      { family: 'Wide', axes: staticAxes(['300', '400', '500', '600', '700', '800']) },
    ])
    // Selected: 400, 700, 600, 500 — then sorted ascending for the URL, which
    // Google's css2 endpoint requires.
    expect(href).toBe(`${GOOGLE_FONTS_CSS2_BASE}?family=Wide:wght@400;500;600;700&display=swap`)
  })

  it('never requests a weight the family does not have', () => {
    const href = buildFontHref([{ family: 'Lobster', axes: staticAxes(['400']) }])
    expect(href).toBe(`${GOOGLE_FONTS_CSS2_BASE}?family=Lobster:wght@400&display=swap`)
    // This is the property that makes the css2 400-Bad-Request failure
    // unreachable: a rejected stylesheet takes down the whole font, not one
    // weight, so the builder must never be able to ask for a missing weight.
    for (const weight of ['300', '500', '600', '700', '800']) {
      expect(href).not.toContain(weight)
    }
  })

  it('combines two families into one request with two family params', () => {
    const href = buildFontHref([
      { family: 'Inter', axes: variable(100, 900) },
      { family: 'Lora', axes: variable(400, 700) },
    ])
    expect(href).toBe(
      `${GOOGLE_FONTS_CSS2_BASE}?family=Inter:wght@300..800&family=Lora:wght@400..700&display=swap`,
    )
  })

  it('deduplicates when body and heading are the same family', () => {
    const href = buildFontHref([
      { family: 'Inter', axes: variable(100, 900) },
      { family: 'Inter', axes: variable(100, 900) },
    ])
    expect(href).toBe(`${GOOGLE_FONTS_CSS2_BASE}?family=Inter:wght@300..800&display=swap`)
  })

  it('never requests italics, even for a family that has them', () => {
    const href = buildFontHref([{ family: 'Inter', axes: variable(100, 900) }])
    expect(href).not.toContain('ital')
  })

  it('percent-encodes characters an unescaped space-replace would leave broken, like &', () => {
    const href = buildFontHref([{ family: 'Font & Co', axes: variable(100, 900) }])
    expect(href).toBe(
      `${GOOGLE_FONTS_CSS2_BASE}?family=Font+%26+Co:wght@300..800&display=swap`,
    )
    // Under the old space-only replace, the unencoded `&` would split the query
    // string and produce a bogus extra param. Pin the param count directly.
    expect(href?.match(/family=/g)?.length).toBe(1)
  })

  it('produces a byte-identical URL for the same family, so it stays CDN-cacheable', () => {
    const once = buildFontHref([{ family: 'Inter', axes: variable(100, 900) }])
    const twice = buildFontHref([{ family: 'Inter', axes: variable(100, 900) }])
    expect(once).toBe(twice)
    expect(once).not.toBeNull()
  })
})
