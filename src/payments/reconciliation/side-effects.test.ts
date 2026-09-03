import { describe, it, expect } from 'vitest'
import { decrementStock } from './side-effects'
import type { Order } from '@/payload-types'

type UpdateCall = { id: number | string; data: Record<string, unknown> }

/**
 * Minimal in-memory Payload double. `find` answers the product lookup
 * `decrementStock` does per line; every `update` is recorded so a test can
 * assert on what was written — and, for gift cards, that nothing was.
 */
function makeFake(products: Record<string, unknown>[]) {
  const updates: UpdateCall[] = []
  const payload = {
    async find({ where }: { where: any }) {
      const id = where.and[1].id.equals
      const doc = products.find((p) => p.id === id)
      return { docs: doc ? [doc] : [] }
    },
    async update({ id, data }: { id: number | string; data: Record<string, unknown> }) {
      updates.push({ id, data })
      return { id }
    },
  }
  return { payload: payload as never, updates }
}

const line = (over: Partial<Order['lineItems'][number]>) =>
  ({
    productId: '1',
    title: 'x',
    unitPrice: 1000,
    qty: 2,
    lineTotal: 2000,
    ...over,
  }) as Order['lineItems'][number]

describe('decrementStock', () => {
  it('decrements a normal product by the line qty, floored at 0', async () => {
    const { payload, updates } = makeFake([{ id: 1, stock: 5, issuesGiftCard: false }])
    await decrementStock(payload, 't1', [line({ productId: '1', qty: 2 })])
    expect(updates).toEqual([{ id: 1, data: { stock: 3 } }])
  })

  it('does NOT decrement a gift-card product (product path)', async () => {
    const { payload, updates } = makeFake([{ id: 1, stock: 0, issuesGiftCard: true }])
    await decrementStock(payload, 't1', [line({ productId: '1', qty: 2 })])
    expect(updates).toEqual([])
  })

  it('does NOT decrement a gift-card DENOMINATION (variant path)', async () => {
    const { payload, updates } = makeFake([
      {
        id: 1,
        stock: 0,
        issuesGiftCard: true,
        variants: [{ title: 'AED 100', stock: 0 }],
      },
    ])
    await decrementStock(payload, 't1', [
      line({ productId: '1', qty: 1, variantTitle: 'AED 100' }),
    ])
    expect(updates).toEqual([])
  })

  it('still decrements a normal product’s variant', async () => {
    const { payload, updates } = makeFake([
      { id: 1, stock: 0, variants: [{ title: 'M', stock: 4 }, { title: 'L', stock: 1 }] },
    ])
    await decrementStock(payload, 't1', [line({ productId: '1', qty: 3, variantTitle: 'M' })])
    expect(updates).toEqual([
      { id: 1, data: { variants: [{ title: 'M', stock: 1 }, { title: 'L', stock: 1 }] } },
    ])
  })

  it('leaves a gift card alone even alongside a normal product in the same order', async () => {
    const { payload, updates } = makeFake([
      { id: 1, stock: 7 },
      { id: 2, stock: 0, issuesGiftCard: true },
    ])
    await decrementStock(payload, 't1', [
      line({ productId: '1', qty: 1 }),
      line({ productId: '2', qty: 1 }),
    ])
    expect(updates).toEqual([{ id: 1, data: { stock: 6 } }])
  })
})
