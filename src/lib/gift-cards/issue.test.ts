import { beforeAll, describe, expect, it, vi } from 'vitest'

// The plain `vitest run` (src/**/*.test.ts) config does not load .env.local —
// only the integration config does. issueGiftCardsForOrder hashes a code via
// GIFT_CARD_CODE_KEY, so set it ourselves, same pattern as `./code.test.ts`.
beforeAll(() => {
  process.env.GIFT_CARD_CODE_KEY = 'test-key-not-a-real-secret'
})

import { issueGiftCardsForOrder, planGiftCardIssues } from './issue'
import type { OrderLineItem } from '@/lib/orders-math'
import type { Payload } from 'payload'

const line = (over: Partial<OrderLineItem> = {}): OrderLineItem => ({
  productId: 'p1',
  title: 'Gift card',
  unitPrice: 5000,
  qty: 1,
  lineTotal: 5000,
  ...over,
})

describe('planGiftCardIssues', () => {
  it('plans nothing for an order with no gift-card lines', () => {
    expect(planGiftCardIssues([line({ isGiftCard: false })])).toEqual([])
  })

  it('plans one card per unit, each at the unit price', () => {
    expect(planGiftCardIssues([line({ isGiftCard: true, qty: 3, lineTotal: 15000 })])).toEqual([
      { amountMinor: 5000 },
      { amountMinor: 5000 },
      { amountMinor: 5000 },
    ])
  })

  it('uses the unit price, not the line total, so denominations stay right', () => {
    const plans = planGiftCardIssues([line({ isGiftCard: true, unitPrice: 10000, qty: 2, lineTotal: 20000 })])
    expect(plans.every((p) => p.amountMinor === 10000)).toBe(true)
    expect(plans).toHaveLength(2)
  })

  it('handles several gift-card lines of different denominations', () => {
    const plans = planGiftCardIssues([
      line({ isGiftCard: true, unitPrice: 5000, qty: 1, lineTotal: 5000 }),
      line({ productId: 'p2', isGiftCard: true, unitPrice: 25000, qty: 2, lineTotal: 50000 }),
    ])
    expect(plans.map((p) => p.amountMinor)).toEqual([5000, 25000, 25000])
  })
})

/**
 * Minimal in-memory Payload double, same style as
 * `payment-event-handler.test.ts`'s `makeFake` — just `count` (the shortfall
 * check) and `create` (gift-cards + gift-card-transactions), nothing else.
 * `existingCount` stands in for cards a previous, partially-failed call
 * already minted for this order.
 */
function makeFakePayload(existingCount: number) {
  const created: { collection: string; data: Record<string, unknown> }[] = []
  const count = vi.fn(async () => ({ totalDocs: existingCount }))
  const create = vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    created.push({ collection, data })
    return { id: created.length }
  })
  const payload = { count, create } as unknown as Payload
  return { payload, count, create, created }
}

const order = (over: Partial<Parameters<typeof issueGiftCardsForOrder>[1]> = {}) => ({
  id: 'o1',
  storeId: 't1',
  currency: 'AED',
  lineItems: [line({ isGiftCard: true, unitPrice: 5000, qty: 3, lineTotal: 15000 })],
  ...over,
})

describe('issueGiftCardsForOrder idempotency', () => {
  it('mints only the shortfall when some cards already exist', async () => {
    const { payload, count, create, created } = makeFakePayload(1) // 1 of 3 already minted
    const issued = await issueGiftCardsForOrder(payload, order())

    expect(issued).toHaveLength(2) // 3 planned - 1 existing = 2 minted this call
    expect(issued.every((c) => c.amountMinor === 5000)).toBe(true)
    expect(created.filter((c) => c.collection === 'gift-cards')).toHaveLength(2)
    expect(created.filter((c) => c.collection === 'gift-card-transactions')).toHaveLength(2)
    expect(count).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(4) // 2 gift-cards + 2 matching transactions
  })

  /**
   * The test above cannot fail on a wrong slice: all three planned cards share
   * one denomination, so `plans.slice(1)` and `plans.slice(0, 2)` — or no slice
   * at all — produce indistinguishable amounts. This one makes the slice
   * observable. Plan order is [5000, 25000, 25000] (`planGiftCardIssues` walks
   * line items in order); with one card already minted the outstanding two must
   * be the LAST two, 25000 and 25000. Slicing from the wrong end would mint
   * 5000 + 25000 and quietly short-change the recipient by 20000.
   */
  it('mints the right denominations, not just the right count, when lines differ', async () => {
    const { payload, created } = makeFakePayload(1) // the 5000 card already exists
    const issued = await issueGiftCardsForOrder(
      payload,
      order({
        lineItems: [
          line({ isGiftCard: true, unitPrice: 5000, qty: 1, lineTotal: 5000 }),
          line({ productId: 'p2', isGiftCard: true, unitPrice: 25000, qty: 2, lineTotal: 50000 }),
        ],
      }),
    )

    expect(issued.map((c) => c.amountMinor)).toEqual([25000, 25000])
    // And the same denominations actually reached the database, balance and
    // initialAmount alike — not just the returned summary.
    const cards = created.filter((c) => c.collection === 'gift-cards')
    expect(cards.map((c) => c.data.balance)).toEqual([25000, 25000])
    expect(cards.map((c) => c.data.initialAmount)).toEqual([25000, 25000])
    expect(
      created.filter((c) => c.collection === 'gift-card-transactions').map((c) => c.data.amount),
    ).toEqual([25000, 25000])
  })

  it('mints nothing once every card has already been issued', async () => {
    const { payload, count, create } = makeFakePayload(3) // all 3 already minted
    const issued = await issueGiftCardsForOrder(payload, order())

    expect(issued).toEqual([])
    expect(count).toHaveBeenCalledTimes(1)
    expect(create).not.toHaveBeenCalled()
  })

  it('never queries the database for an order with no gift-card lines', async () => {
    const { payload, count } = makeFakePayload(0)
    const issued = await issueGiftCardsForOrder(payload, order({ lineItems: [line({ isGiftCard: false })] }))

    expect(issued).toEqual([])
    expect(count).not.toHaveBeenCalled()
  })
})
