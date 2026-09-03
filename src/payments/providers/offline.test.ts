import { describe, it, expect } from 'vitest'
import { offlineProvider } from './offline'
import { isPaymentError } from '@/payments/core/errors'
import type { CreateSessionInput } from '@/payments/core/types'

describe('offlineProvider', () => {
  it('is an offline-kind provider with no secret credentials', () => {
    expect(offlineProvider.kind).toBe('offline')
    expect(offlineProvider.credentialSchema.some((f) => f.secret)).toBe(false)
  })

  it('createSession returns a no-redirect session', async () => {
    const session = await offlineProvider.createSession({
      order: { id: 77 },
      idempotencyKey: 'idem-1',
    } as unknown as CreateSessionInput)
    expect(session.redirect).toEqual({ kind: 'none', orderId: 77 })
    expect(session.providerSessionId).toBe('offline-idem-1')
  })

  it('has no webhook', async () => {
    expect(await offlineProvider.verifyWebhook('', new Headers(), {})).toBeNull()
  })

  it('retrievePayment throws OFFLINE_NO_RETRIEVE', async () => {
    try {
      await offlineProvider.retrievePayment('x', {})
      throw new Error('expected throw')
    } catch (err) {
      expect(isPaymentError(err)).toBe(true)
      expect((err as { code: string }).code).toBe('OFFLINE_NO_RETRIEVE')
    }
  })

  it('testConnection trivially succeeds', async () => {
    expect((await offlineProvider.testConnection({})).ok).toBe(true)
  })
})
