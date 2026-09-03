import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  computePaystackSignature,
  safeCompareHex,
  extractPaystackWebhookIdentity,
  mapPaystackStatus,
} from './paystack'

const SECRET = 'sk_test_secret'
const BODY = JSON.stringify({ event: 'charge.success', data: { id: 99, reference: 'ref_123', status: 'success' } })

function sig(body: string, secret: string) {
  return createHmac('sha512', secret).update(body).digest('hex')
}

describe('computePaystackSignature (HMAC-SHA512)', () => {
  it('matches an independent HMAC and differs on tamper', () => {
    expect(computePaystackSignature(BODY, SECRET)).toBe(sig(BODY, SECRET))
    expect(computePaystackSignature(BODY, SECRET)).not.toBe(sig(BODY + 'x', SECRET))
  })
})

describe('safeCompareHex', () => {
  it('true for equal, false for tamper/length/empty', () => {
    const s = sig(BODY, SECRET)
    expect(safeCompareHex(s, s)).toBe(true)
    expect(safeCompareHex(s, sig(BODY, 'other'))).toBe(false)
    expect(safeCompareHex(s, s.slice(0, 10))).toBe(false)
    expect(safeCompareHex('', '')).toBe(false)
  })
})

describe('extractPaystackWebhookIdentity', () => {
  it('verifies signature and returns identity (event id from data.id)', () => {
    const headers = new Headers({ 'x-paystack-signature': sig(BODY, SECRET) })
    expect(extractPaystackWebhookIdentity(BODY, headers, SECRET)).toEqual({
      providerEventId: '99',
      reference: 'ref_123',
      hint: 'payment',
    })
  })
  it('returns null for a bad or missing signature', () => {
    expect(extractPaystackWebhookIdentity(BODY, new Headers(), SECRET)).toBeNull()
    expect(
      extractPaystackWebhookIdentity(BODY, new Headers({ 'x-paystack-signature': 'a'.repeat(128) }), SECRET),
    ).toBeNull()
  })
})

describe('mapPaystackStatus', () => {
  it('maps statuses', () => {
    expect(mapPaystackStatus('success')).toBe('succeeded')
    expect(mapPaystackStatus('failed')).toBe('failed')
    expect(mapPaystackStatus('abandoned')).toBe('cancelled')
    expect(mapPaystackStatus('ongoing')).toBe('pending')
  })
})
