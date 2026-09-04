import { describe, it, expect } from 'vitest'
import { safeEqual, extractFlutterwaveWebhookIdentity, mapFlutterwaveStatus } from './flutterwave'

const HASH = 'my-secret-hash'
const BODY = JSON.stringify({ event: 'charge.completed', data: { id: 5, tx_ref: 'txr_1', status: 'successful' } })

describe('safeEqual', () => {
  it('true for equal, false otherwise', () => {
    expect(safeEqual(HASH, HASH)).toBe(true)
    expect(safeEqual(HASH, 'other')).toBe(false)
    expect(safeEqual('', '')).toBe(false)
  })
})

describe('extractFlutterwaveWebhookIdentity', () => {
  it('verifies verif-hash and returns identity', () => {
    const headers = new Headers({ 'verif-hash': HASH })
    expect(extractFlutterwaveWebhookIdentity(BODY, headers, HASH)).toEqual({
      providerEventId: '5',
      reference: 'txr_1',
      hint: 'payment',
    })
  })
  it('returns null when the hash is wrong or missing', () => {
    expect(extractFlutterwaveWebhookIdentity(BODY, new Headers(), HASH)).toBeNull()
    expect(extractFlutterwaveWebhookIdentity(BODY, new Headers({ 'verif-hash': 'nope' }), HASH)).toBeNull()
  })
})

describe('mapFlutterwaveStatus', () => {
  it('maps statuses', () => {
    expect(mapFlutterwaveStatus('successful')).toBe('succeeded')
    expect(mapFlutterwaveStatus('failed')).toBe('failed')
    expect(mapFlutterwaveStatus('pending')).toBe('pending')
  })
})
