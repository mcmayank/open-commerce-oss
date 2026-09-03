import { describe, it, expect } from 'vitest'
import { nextIndex, prevIndex } from './gallery-nav'

describe('gallery-nav', () => {
  it('advances and wraps at the end', () => {
    expect(nextIndex(0, 3)).toBe(1)
    expect(nextIndex(2, 3)).toBe(0)
  })

  it('goes back and wraps at the start', () => {
    expect(prevIndex(2, 3)).toBe(1)
    expect(prevIndex(0, 3)).toBe(2)
  })

  it('is a no-op for a single image or empty set', () => {
    expect(nextIndex(0, 1)).toBe(0)
    expect(prevIndex(0, 1)).toBe(0)
    expect(nextIndex(0, 0)).toBe(0)
  })
})
