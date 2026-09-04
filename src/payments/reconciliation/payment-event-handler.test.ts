import { describe, it, expect, vi, beforeEach } from 'vitest'

// Isolate the decision logic — the fulfilment side-effects are covered by the
// integration tests against a real Payload.
vi.mock('./side-effects', () => ({ runPaidSideEffects: vi.fn(async () => {}) }))
// The actual money movement (real Postgres UPDATE via payload.db.drizzle) is
// proven against a real database in tests/int/gift-card-reserve.int.spec.ts.
// Here we only need to prove WHICH branches call it.
vi.mock('@/lib/gift-cards/redeem', () => ({ reverseGiftCardForOrder: vi.fn(async () => 0) }))

import { reconcile } from './payment-event-handler'
import { runPaidSideEffects } from './side-effects'
import { reverseGiftCardForOrder } from '@/lib/gift-cards/redeem'
import type { RetrievedPayment } from '@/payments/core/types'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

interface FakeState {
  order: Record<string, unknown> | null
  attempt: Record<string, unknown> | null
}

/** Minimal in-memory Payload double with a unique (tenant,provider,eventId) guard. */
function makeFake(state: FakeState) {
  const processed = new Set<string>()
  const payload = {
    async create({ collection, data }: { collection: string; data: Record<string, unknown> }) {
      if (collection === 'processed-webhook-events') {
        const key = `${data.tenant}:${data.provider}:${data.providerEventId}`
        if (processed.has(key)) {
          const e = new Error('duplicate key') as Error & { code?: string }
          e.code = '23505'
          throw e
        }
        processed.add(key)
        return { id: 'pe1' }
      }
      return { id: 'x' }
    },
    async find({ collection }: { collection: string }) {
      if (collection === 'payment-attempts') return { docs: state.attempt ? [state.attempt] : [] }
      return { docs: [] }
    },
    async findByID({ collection }: { collection: string }) {
      if (collection === 'orders') return state.order
      if (collection === 'payment-attempts') return state.attempt
      return null
    },
    async update({ collection, data }: { collection: string; data: Record<string, unknown> }) {
      if (collection === 'orders' && state.order) Object.assign(state.order, data)
      if (collection === 'payment-attempts' && state.attempt) Object.assign(state.attempt, data)
      return { id: 'x' }
    },
    async delete() {
      processed.clear()
      return { id: 'x' }
    },
  }
  return payload as never
}

function loadedWith(retrieved: RetrievedPayment) {
  return {
    configId: 'c1',
    slug: 'stripe',
    environment: 'test' as const,
    enabled: true,
    credentials: {},
    provider: { retrievePayment: vi.fn(async () => retrieved) } as never,
  }
}

const baseAttempt = () => ({ id: 'a1', order: 'o1', provider: 'stripe', providerSessionId: 'cs_1', tenant: 't1' })
const baseOrder = () => ({ id: 'o1', tenant: 't1', currency: 'INR', total: 25000, status: 'pending', lineItems: [] })
const verified = { providerEventId: 'evt_1', reference: 'cs_1' as string }

beforeEach(() => vi.clearAllMocks())

describe('reconcile', () => {
  it('succeeded → marks paid once and fulfils', async () => {
    const state: FakeState = { order: baseOrder(), attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR', providerPaymentId: 'pi_1' }),
      verified,
    })
    expect(res.status).toBe('paid')
    expect(state.order?.status).toBe('paid')
    expect(state.attempt?.status).toBe('succeeded')
    expect(runPaidSideEffects).toHaveBeenCalledOnce()
  })

  it('duplicate event → no second fulfilment', async () => {
    const state: FakeState = { order: baseOrder(), attempt: baseAttempt() }
    const payload = makeFake(state)
    const loaded = loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR' })
    await reconcile({ payload, tenant: { id: 't1' }, loaded, verified })
    const second = await reconcile({ payload, tenant: { id: 't1' }, loaded, verified })
    expect(second.status).toBe('duplicate')
    expect(runPaidSideEffects).toHaveBeenCalledOnce()
  })

  it('authorized → does NOT fulfil, order stays pending', async () => {
    const state: FakeState = { order: baseOrder(), attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'authorized', amountMinor: 25000, currency: 'INR' }),
      verified,
    })
    expect(res.status).toBe('authorized')
    expect(state.order?.status).toBe('pending')
    expect(state.order?.authorizedAt).toBeTruthy()
    expect(runPaidSideEffects).not.toHaveBeenCalled()
  })

  it('amount mismatch → not paid', async () => {
    const state: FakeState = { order: baseOrder(), attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 9999, currency: 'INR' }),
      verified,
    })
    expect(res.status).toBe('amount_mismatch')
    expect(state.order?.status).toBe('pending')
    expect(runPaidSideEffects).not.toHaveBeenCalled()
  })

  // A gift card is TENDER, not a discount: `order.total` stays the full
  // invoice amount and the gateway only ever captures `total - giftCardAmount`.
  // These three guard the fix directly — the first proves an ordinary order
  // (no gift card) still reconciles against its full total unchanged, and the
  // other two prove BOTH directions of the split: the reduced capture is
  // accepted, and the full total is now correctly REJECTED as a mismatch. That
  // second rejection is deliberate: it is what stops someone "fixing" a future
  // false mismatch by loosening the comparison back to `=== order.total`,
  // which would silently let a double-charge (gift card + full gateway
  // capture) through as "paid".
  it('no gift card on the order → still reconciles against the full total', async () => {
    const state: FakeState = { order: baseOrder(), attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR', providerPaymentId: 'pi_1' }),
      verified,
    })
    expect(res.status).toBe('paid')
    expect(state.order?.status).toBe('paid')
  })

  it('gift card applied → reconciles when the capture equals total minus the card', async () => {
    const state: FakeState = { order: { ...baseOrder(), giftCardAmount: 5000 }, attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      // Order total 25000, card covered 5000 → the gateway was only ever
      // asked to capture 20000.
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 20000, currency: 'INR', providerPaymentId: 'pi_1' }),
      verified,
    })
    expect(res.status).toBe('paid')
    expect(state.order?.status).toBe('paid')
  })

  it('gift card applied → REJECTS a capture equal to the full total (would double-charge)', async () => {
    const state: FakeState = { order: { ...baseOrder(), giftCardAmount: 5000 }, attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      // The gateway should only ever have been asked for 20000. A retrieved
      // amount of the full 25000 means the caller that started this attempt
      // never applied the gift-card reduction — reject it rather than mark
      // the order paid on top of the money already taken off the card.
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR', providerPaymentId: 'pi_1' }),
      verified,
    })
    expect(res.status).toBe('amount_mismatch')
    expect(state.order?.status).toBe('pending')
    expect(runPaidSideEffects).not.toHaveBeenCalled()
  })

  it('currency mismatch → not paid', async () => {
    const state: FakeState = { order: baseOrder(), attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'USD' }),
      verified,
    })
    expect(res.status).toBe('currency_mismatch')
    expect(state.order?.status).toBe('pending')
  })

  it('store mismatch → 400, mutates nothing', async () => {
    const state: FakeState = { order: { ...baseOrder(), tenant: 't2' }, attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR' }),
      verified,
    })
    expect(res.status).toBe('store_mismatch')
    expect(res.httpStatus).toBe(400)
    expect(state.order?.status).toBe('pending')
  })

  it('already paid → idempotent no-op', async () => {
    const state: FakeState = { order: { ...baseOrder(), status: 'paid' }, attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR' }),
      verified,
    })
    expect(res.status).toBe('already_paid')
    expect(runPaidSideEffects).not.toHaveBeenCalled()
  })

  it('no matching attempt → unresolved', async () => {
    const state: FakeState = { order: baseOrder(), attempt: null }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR' }),
      verified,
    })
    expect(res.status).toBe('unresolved')
  })

  // Task 7: a gift-card reservation taken off a card at checkout must go back
  // when the attempt does not pan out. `failed` / `cancelled` / `expired` are
  // terminal at the gateway — release. `pending` is not — the payment may
  // still land, and releasing now would let the same balance be spent
  // elsewhere while this attempt is still alive.
  it.each(['failed', 'cancelled', 'expired'] as const)(
    'outcome %s → releases the gift-card reservation',
    async (outcome) => {
      // giftCardAmount: 5000 on a 25000 total → expected capture 20000. Match
      // it so the run reaches the outcome branch rather than amount_mismatch.
      const state: FakeState = { order: { ...baseOrder(), giftCardAmount: 5000 }, attempt: baseAttempt() }
      const res = await reconcile({
        payload: makeFake(state),
        tenant: { id: 't1' },
        loaded: loadedWith({ outcome, amountMinor: 20000, currency: 'INR' }),
        verified,
      })
      expect(res.status).toBe('not_succeeded')
      expect(reverseGiftCardForOrder).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
        tenantId: 't1',
        orderId: 'o1',
      })
    },
  )

  it('outcome pending → does NOT release the gift-card reservation', async () => {
    const state: FakeState = { order: { ...baseOrder(), giftCardAmount: 5000 }, attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'pending', amountMinor: 20000, currency: 'INR' }),
      verified,
    })
    expect(res.status).toBe('not_succeeded')
    expect(reverseGiftCardForOrder).not.toHaveBeenCalled()
  })

  // The hazard a reviewer raised: once a reservation is released, a LATE
  // webhook reporting the true capture would be compared against the full
  // order total (giftCardAmount now cleared) and wrongly rejected as an
  // amount mismatch. Deliberately NOT wired here — currency/amount mismatches
  // are our OWN validation guard, not a gateway-reported terminal outcome, so
  // reversing on them would create exactly that hazard. See task-7-report.md.
  it('amount mismatch does NOT release the gift-card reservation', async () => {
    const state: FakeState = { order: { ...baseOrder(), giftCardAmount: 5000 }, attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR' }),
      verified,
    })
    expect(res.status).toBe('amount_mismatch')
    expect(reverseGiftCardForOrder).not.toHaveBeenCalled()
  })

  it('currency mismatch does NOT release the gift-card reservation', async () => {
    const state: FakeState = { order: { ...baseOrder(), giftCardAmount: 5000 }, attempt: baseAttempt() }
    const res = await reconcile({
      payload: makeFake(state),
      tenant: { id: 't1' },
      loaded: loadedWith({ outcome: 'succeeded', amountMinor: 25000, currency: 'USD' }),
      verified,
    })
    expect(res.status).toBe('currency_mismatch')
    expect(reverseGiftCardForOrder).not.toHaveBeenCalled()
  })
})
