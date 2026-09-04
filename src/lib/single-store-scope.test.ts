import { describe, expect, it, vi } from 'vitest'

// The OSS twin flips the seam; this checks core's helpers collapse correctly.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: false }))
const { storeIdOf, storeRef, storeWhere } = await import('@/store-scope')

describe('store-scope (single store)', () => {
  it('filters and refs are empty, so queries and writes ignore the store', () => {
    expect(storeWhere(7)).toEqual({})
    expect(storeRef(7)).toEqual({})
  })

  it('every document belongs to store 1', () => {
    expect(storeIdOf({})).toBe(1)
    expect(storeIdOf({ tenant: 9 })).toBe(1)
  })
})
