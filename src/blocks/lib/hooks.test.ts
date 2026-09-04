import { describe, it, expect } from 'vitest'
import { NB_PARTS, isNbPart } from './hooks'

describe('nb-hooks part vocabulary', () => {
  it('is the eleven published names', () => {
    expect([...NB_PARTS].sort()).toEqual(
      [
        'badge',
        'body',
        'cta',
        'eyebrow',
        'heading',
        'item',
        'item-body',
        'item-heading',
        'item-media',
        'link',
        'media',
      ],
    )
  })

  it('accepts a published name', () => {
    expect(isNbPart('item-heading')).toBe(true)
  })

  it('accepts the newly published names', () => {
    expect(isNbPart('eyebrow')).toBe(true)
    expect(isNbPart('badge')).toBe(true)
    expect(isNbPart('link')).toBe(true)
  })

  it('rejects an unpublished name', () => {
    expect(isNbPart('phantom')).toBe(false)
  })
})
