import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { scanBlockStyleParts } from './scan-parts'

const BLOCKS_DIR = path.resolve(__dirname, '../../blocks')

describe('scanBlockStyleParts', () => {
  const scanned = scanBlockStyleParts(BLOCKS_DIR)

  it('finds every vocabulary group for Hero, the one block that reads them all', () => {
    expect(scanned.get('Hero')).toEqual([
      'accent',
      'eyebrow',
      'heading',
      'media',
      'section',
      'subheading',
    ])
  })

  it('resolves groups reached through a shared vocab-classes import, not just literal --bs- text', () => {
    // FAQ imports HEADING_2XL and contains no literal `--bs-heading-` of its own.
    expect(scanned.get('FAQ')).toEqual(['heading', 'section'])
  })

  it('reports nothing for the four blocks never wired to the vocabulary', () => {
    for (const dir of ['Spacer', 'CustomSection', 'SplitHero', 'MediaHero']) {
      expect(scanned.get(dir)).toEqual([])
    }
  })

  it('does not count references found in test files', () => {
    // ProductGrid reads eyebrow, heading and section — nothing more, even though
    // sibling test files mention other groups.
    expect(scanned.get('ProductGrid')).toEqual(['eyebrow', 'heading', 'section'])
  })

  it('returns an entry for every block directory it walked', () => {
    expect(scanned.size).toBeGreaterThanOrEqual(24)
    expect([...scanned.values()].every(Array.isArray)).toBe(true)
  })
})
