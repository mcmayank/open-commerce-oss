import { describe, expect, it } from 'vitest'
import { addItem, cartCount, parseCart, removeItem, serializeCart, updateQty, type Cart } from './cart'

describe('parseCart', () => {
  it('returns empty cart for undefined/garbage', () => {
    expect(parseCart(undefined)).toEqual([])
    expect(parseCart('not json')).toEqual([])
    expect(parseCart('{"a":1}')).toEqual([]) // not an array
  })
  it('drops malformed lines and coerces qty', () => {
    const raw = JSON.stringify([
      { productId: 'p1', qty: 2 },
      { productId: 'p2', variantId: 'v1', qty: 3 },
      { productId: '', qty: 5 }, // dropped: no productId
      { productId: 'p3', qty: 0 }, // dropped: qty < 1
    ])
    expect(parseCart(raw)).toEqual([
      { productId: 'p1', qty: 2 },
      { productId: 'p2', variantId: 'v1', qty: 3 },
    ])
  })
})

describe('addItem', () => {
  it('adds a new line', () => {
    expect(addItem([], 'p1', undefined, 1)).toEqual([{ productId: 'p1', qty: 1 }])
  })
  it('merges quantity for the same product+variant', () => {
    const c: Cart = [{ productId: 'p1', variantId: 'v1', qty: 1 }]
    expect(addItem(c, 'p1', 'v1', 2)).toEqual([{ productId: 'p1', variantId: 'v1', qty: 3 }])
  })
  it('keeps different variants of the same product separate', () => {
    const c: Cart = [{ productId: 'p1', variantId: 'v1', qty: 1 }]
    expect(addItem(c, 'p1', 'v2', 1)).toEqual([
      { productId: 'p1', variantId: 'v1', qty: 1 },
      { productId: 'p1', variantId: 'v2', qty: 1 },
    ])
  })
})

describe('updateQty', () => {
  it('sets quantity', () => {
    const c: Cart = [{ productId: 'p1', qty: 1 }]
    expect(updateQty(c, 'p1', undefined, 5)).toEqual([{ productId: 'p1', qty: 5 }])
  })
  it('removes the line when qty <= 0', () => {
    const c: Cart = [{ productId: 'p1', qty: 1 }]
    expect(updateQty(c, 'p1', undefined, 0)).toEqual([])
  })
})

describe('removeItem / cartCount', () => {
  it('removes a specific line', () => {
    const c: Cart = [{ productId: 'p1', qty: 1 }, { productId: 'p2', qty: 2 }]
    expect(removeItem(c, 'p2', undefined)).toEqual([{ productId: 'p1', qty: 1 }])
  })
  it('counts total quantity', () => {
    expect(cartCount([{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 3 }])).toBe(5)
  })
})

describe('serializeCart round-trips', () => {
  it('serialize→parse is identity', () => {
    const c: Cart = [{ productId: 'p1', variantId: 'v1', qty: 2 }]
    expect(parseCart(serializeCart(c))).toEqual(c)
  })
})
