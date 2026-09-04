import { describe, it, expect, vi } from 'vitest'
import { startPaymentAttempt } from './payment-service'
import type { LoadedPaymentConfig } from './config-loader'
import type { Order } from '@/payload-types'

/** Minimal in-memory Payload double — just enough to reach the guard or the adapter call. */
function makeFakePayload() {
  return {
    async create({ collection }: { collection: string }) {
      if (collection === 'payment-attempts') return { id: 'a1' }
      return { id: 'x' }
    },
    async update() {
      return { id: 'x' }
    },
  } as never
}

function makeOrder(total: number): Order {
  return { id: 'o1', tenant: 't1', total, currency: 'INR' } as unknown as Order
}

function makeLoaded(createSession: LoadedPaymentConfig['provider']['createSession']): LoadedPaymentConfig {
  return {
    configId: 'c1',
    slug: 'stripe',
    environment: 'test',
    enabled: true,
    credentials: {},
    provider: { createSession } as never,
  }
}

const baseArgs = {
  returnUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
  webhookUrl: 'https://example.com/webhook',
  idempotencyKey: 'idem_1',
}

describe('startPaymentAttempt — amountMinor guard', () => {
  it('defaults to order.total and succeeds when amountMinor is omitted', async () => {
    const createSession = vi.fn(async () => ({
      providerSessionId: 'sess_1',
      redirect: { kind: 'url' as const, url: 'https://pay.example.com' },
    }))
    const result = await startPaymentAttempt({
      payload: makeFakePayload(),
      order: makeOrder(25000),
      loaded: makeLoaded(createSession),
      ...baseArgs,
    })
    expect(result.redirect).toEqual({ kind: 'url', url: 'https://pay.example.com' })
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 25000 }))
  })

  it('accepts an explicit amountMinor at or below order.total (gift card applied)', async () => {
    const createSession = vi.fn(async () => ({
      providerSessionId: 'sess_1',
      redirect: { kind: 'url' as const, url: 'https://pay.example.com' },
    }))
    await startPaymentAttempt({
      payload: makeFakePayload(),
      order: makeOrder(25000),
      loaded: makeLoaded(createSession),
      amountMinor: 20000,
      ...baseArgs,
    })
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 20000 }))
  })

  it('accepts amountMinor === 0 (the zero boundary; Task 8 skips calling this at all in practice)', async () => {
    const createSession = vi.fn(async () => ({
      providerSessionId: 'sess_1',
      redirect: { kind: 'url' as const, url: 'https://pay.example.com' },
    }))
    await startPaymentAttempt({
      payload: makeFakePayload(),
      order: makeOrder(25000),
      loaded: makeLoaded(createSession),
      amountMinor: 0,
      ...baseArgs,
    })
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 0 }))
  })

  // The invariant this function protects: nothing may ask a gateway to
  // capture more than the order's own invoice total, go negative, or hand it
  // a fractional minor unit. A caller getting this wrong is a bug — the
  // function throws rather than silently clamping into something that looks
  // like it worked.
  it('rejects amountMinor greater than order.total', async () => {
    const createSession = vi.fn()
    await expect(
      startPaymentAttempt({
        payload: makeFakePayload(),
        order: makeOrder(25000),
        loaded: makeLoaded(createSession),
        amountMinor: 25001,
        ...baseArgs,
      }),
    ).rejects.toThrow(/amountMinor/)
    expect(createSession).not.toHaveBeenCalled()
  })

  it('rejects a negative amountMinor', async () => {
    const createSession = vi.fn()
    await expect(
      startPaymentAttempt({
        payload: makeFakePayload(),
        order: makeOrder(25000),
        loaded: makeLoaded(createSession),
        amountMinor: -1,
        ...baseArgs,
      }),
    ).rejects.toThrow(/amountMinor/)
    expect(createSession).not.toHaveBeenCalled()
  })

  it('rejects a non-integer amountMinor', async () => {
    const createSession = vi.fn()
    await expect(
      startPaymentAttempt({
        payload: makeFakePayload(),
        order: makeOrder(25000),
        loaded: makeLoaded(createSession),
        amountMinor: 100.5,
        ...baseArgs,
      }),
    ).rejects.toThrow(/amountMinor/)
    expect(createSession).not.toHaveBeenCalled()
  })

  it('never creates a payment-attempts row when the guard rejects the amount', async () => {
    const create = vi.fn(async () => ({ id: 'a1' }))
    const payload = { create, update: vi.fn(async () => ({ id: 'x' })) } as never
    await expect(
      startPaymentAttempt({
        payload,
        order: makeOrder(25000),
        loaded: makeLoaded(vi.fn()),
        amountMinor: 999999,
        ...baseArgs,
      }),
    ).rejects.toThrow()
    expect(create).not.toHaveBeenCalled()
  })
})
