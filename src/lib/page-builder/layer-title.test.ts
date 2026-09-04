import { describe, it, expect } from 'vitest'
import { layerTitle } from './layer-title'

describe('layerTitle', () => {
  it('prefers the block\'s heading so the rail reads like the page', () => {
    expect(layerTitle({ heading: 'Fresh from the oven, daily' }, 'Hero')).toBe(
      'Fresh from the oven, daily',
    )
  })

  it('falls back through the candidate fields in order', () => {
    expect(layerTitle({ title: 'Best sellers' }, 'Product Grid')).toBe('Best sellers')
    expect(layerTitle({ label: 'Free delivery' }, 'Ticker')).toBe('Free delivery')
  })

  it('prefers an earlier candidate field over a later one when both are set', () => {
    expect(layerTitle({ heading: 'X', title: 'Y' }, 'Hero')).toBe('X')
    expect(layerTitle({ title: 'X', label: 'Y' }, 'Hero')).toBe('X')
  })

  it('uses the block label when the block carries no words at all', () => {
    expect(layerTitle({}, 'Image Gallery')).toBe('Image Gallery')
    expect(layerTitle({ heading: '   ' }, 'Hero')).toBe('Hero')
  })

  it('ignores non-string values rather than rendering [object Object]', () => {
    expect(layerTitle({ heading: { root: {} } }, 'Rich Text')).toBe('Rich Text')
    expect(layerTitle({ heading: 42 }, 'Hero')).toBe('Hero')
  })

  it('collapses internal whitespace runs into a single space', () => {
    expect(layerTitle({ heading: 'Fresh   from the   oven' }, 'Hero')).toBe(
      'Fresh from the oven',
    )
  })

  it('truncates long headings on a word boundary', () => {
    const long = 'Sourdough proved for thirty six hours and laminated pastry rolled every morning'
    const out = layerTitle({ heading: long }, 'Hero')
    expect(out.length).toBeLessThanOrEqual(49)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toContain('  ')
  })
})
