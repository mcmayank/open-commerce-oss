import { describe, expect, it } from 'vitest'
import { parentPathOf } from './variant-path'

describe('parentPathOf', () => {
  it('drops the trailing field segment', () => {
    expect(parentPathOf('layout.0.variant')).toBe('layout.0')
  })
  it('handles multi-digit indices', () => {
    expect(parentPathOf('layout.12.variant')).toBe('layout.12')
  })
  it('returns empty string when there is no parent', () => {
    expect(parentPathOf('variant')).toBe('')
  })
})
