import { describe, expect, it } from 'vitest'
import { findNewCustomSections } from './custom-section-diff'

const cs = (id: string) => ({ id, blockType: 'customSection' })

describe('findNewCustomSections', () => {
  it('counts a newly added custom section', () => {
    expect(findNewCustomSections([cs('a')], null)).toBe(1)
  })

  it('grandfathers one already present under the same block id', () => {
    expect(findNewCustomSections([cs('a')], [cs('a')])).toBe(0)
  })

  it('counts only the new one when an existing section is kept', () => {
    expect(findNewCustomSections([cs('a'), cs('b')], [cs('a')])).toBe(1)
  })

  it('ignores other block types', () => {
    expect(findNewCustomSections([{ id: 'x', blockType: 'hero' }], null)).toBe(0)
  })

  it('counts a section with no id as new — it cannot be matched to anything', () => {
    expect(findNewCustomSections([{ blockType: 'customSection' }], [cs('a')])).toBe(1)
  })

  it('returns 0 for a non-array layout', () => {
    expect(findNewCustomSections(undefined, null)).toBe(0)
  })

  it('counts a duplicated grandfathered id as one new section, not zero', () => {
    expect(findNewCustomSections([cs('a'), cs('a')], [cs('a')])).toBe(1)
  })

  it('counts all but one of several blocks sharing one grandfathered id', () => {
    expect(findNewCustomSections([cs('a'), cs('a'), cs('a')], [cs('a')])).toBe(2)
  })

  it('still grandfathers two distinct ids that each match once', () => {
    expect(findNewCustomSections([cs('a'), cs('b')], [cs('a'), cs('b')])).toBe(0)
  })

  it('treats a non-array original as nothing to grandfather instead of throwing', () => {
    // `originalDoc.layout` is whatever the row holds. A non-array is not iterable,
    // so `for (const b of original ?? [])` threw inside the Pages beforeChange
    // hook and blocked the save. seedCustomSectionSchemes already guarded this
    // input; this function's docblock claims the two mirror each other.
    const notArray = { 0: cs('a') } as any
    expect(() => findNewCustomSections([cs('a')], notArray)).not.toThrow()
    expect(findNewCustomSections([cs('a')], notArray)).toBe(1)
    expect(findNewCustomSections([cs('a')], 'nonsense' as any)).toBe(1)
  })
})
