import { describe, it, expect } from 'vitest'
import { safeEqual, extractXenditWebhookIdentity, mapXenditStatus } from './xendit'

const TOKEN = 'callback-token-xyz'
const BODY = JSON.stringify({ id: 'inv_123', status: 'PAID', external_id: 'ext_1' })

describe('safeEqual', () => {
  it('true for equal, false otherwise', () => {
    expect(safeEqual(TOKEN, TOKEN)).toBe(true)
    expect(safeEqual(TOKEN, 'other')).toBe(false)
  })
})

describe('extractXenditWebhookIdentity', () => {
  it('verifies the callback token and uses the invoice id as reference', () => {
    const headers = new Headers({ 'x-callback-token': TOKEN })
    expect(extractXenditWebhookIdentity(BODY, headers, TOKEN)).toEqual({
      providerEventId: 'inv_123',
      reference: 'inv_123',
      hint: 'payment',
    })
  })
  it('returns null for a wrong or missing token', () => {
    expect(extractXenditWebhookIdentity(BODY, new Headers(), TOKEN)).toBeNull()
    expect(extractXenditWebhookIdentity(BODY, new Headers({ 'x-callback-token': 'no' }), TOKEN)).toBeNull()
  })
})

describe('mapXenditStatus', () => {
  it('maps statuses', () => {
    expect(mapXenditStatus('PAID')).toBe('succeeded')
    expect(mapXenditStatus('SETTLED')).toBe('succeeded')
    expect(mapXenditStatus('EXPIRED')).toBe('expired')
    expect(mapXenditStatus('PENDING')).toBe('pending')
  })
})
