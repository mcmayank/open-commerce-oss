import { describe, expect, it } from 'vitest'
import { isValidSlugFormat, safeSlugify, slugify } from './slug'

describe('isValidSlugFormat', () => {
  it.each(['tshirt', 'red-shirt', 'item-42'])('accepts %s', (s) => {
    expect(isValidSlugFormat(s)).toBe(true)
  })
  it.each(['', 'a', 'Red-Shirt', 'red shirt', 'red_shirt', '-red', 'red-', 'réd'])('rejects %s', (s) => {
    expect(isValidSlugFormat(s)).toBe(false)
  })
})

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Red T-Shirt')).toBe('red-t-shirt')
  })
  it('strips punctuation and collapses separators', () => {
    expect(slugify('  Summer!! Sale  2026 ')).toBe('summer-sale-2026')
  })
  it('trims leading/trailing hyphens', () => {
    expect(slugify('--Hello--')).toBe('hello')
  })
})

describe('safeSlugify', () => {
  it('slugifies a normal product title', () => {
    expect(safeSlugify('Plain Sourdough Croissant')).toBe('plain-sourdough-croissant')
  })

  it('handles ampersands the way a bakery writes them', () => {
    expect(safeSlugify('Cheese & Zaatar Croissant')).toBe('cheese-zaatar-croissant')
  })

  it('strips accents', () => {
    expect(safeSlugify('Café Crème')).toBe('cafe-creme')
  })

  it('returns null when the result would be too short to be valid', () => {
    // slugify('A') === 'a', which isValidSlugFormat rejects (min 2 chars).
    expect(safeSlugify('A')).toBeNull()
  })

  it('returns null when there is nothing sluggable', () => {
    expect(safeSlugify('!!!')).toBeNull()
    expect(safeSlugify('')).toBeNull()
  })

  it('never returns a value that isValidSlugFormat would reject', () => {
    const titles = [
      'Plain Sourdough Croissant',
      'Cheese & Zaatar Croissant',
      'Café Crème',
      '  Summer!! Sale  2026 ',
      'A very long product title that keeps going well past the sixty character limit imposed by the slug format',
      '--Hello--',
    ]
    for (const t of titles) {
      const s = safeSlugify(t)
      if (s !== null) expect(isValidSlugFormat(s), `${t} -> ${s}`).toBe(true)
    }
  })

  it('caps long titles at the 60-char limit without a trailing hyphen', () => {
    const s = safeSlugify('A very long product title that keeps going well past the sixty character limit')
    expect(s).not.toBeNull()
    expect(s!.length).toBeLessThanOrEqual(60)
    expect(s!.endsWith('-')).toBe(false)
  })
})
