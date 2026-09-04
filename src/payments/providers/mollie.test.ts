import { describe, it, expect } from 'vitest'
import { mollieAmountValue, extractMollieWebhookId, mapMollieStatus, mollieProvider } from './mollie'

describe('mollieAmountValue (exponent-aware decimal string)', () => {
  it('formats 2-decimal currencies', () => {
    expect(mollieAmountValue(1000, 'EUR')).toBe('10.00')
  })
  it('formats 0-decimal currencies without decimals', () => {
    expect(mollieAmountValue(1000, 'JPY')).toBe('1000')
  })
})

describe('extractMollieWebhookId', () => {
  it('reads a tr_ id from a form-encoded body', () => {
    expect(extractMollieWebhookId('id=tr_abc123')).toBe('tr_abc123')
  })
  it('returns null for a non-payment id or junk', () => {
    expect(extractMollieWebhookId('id=sub_x')).toBeNull()
    expect(extractMollieWebhookId('nonsense')).toBeNull()
  })
})

describe('mapMollieStatus — authorized is not succeeded', () => {
  it('maps statuses', () => {
    expect(mapMollieStatus('paid')).toBe('succeeded')
    expect(mapMollieStatus('authorized')).toBe('authorized')
    expect(mapMollieStatus('open')).toBe('pending')
    expect(mapMollieStatus('expired')).toBe('expired')
    expect(mapMollieStatus('canceled')).toBe('cancelled')
    expect(mapMollieStatus('failed')).toBe('failed')
  })
})

describe('mollieProvider.verifyWebhook — identity only, no signature', () => {
  it('returns identity from the id and nothing else', async () => {
    const result = await mollieProvider.verifyWebhook('id=tr_xyz', new Headers(), { apiKey: 'test_x' })
    expect(result).toEqual({ providerEventId: 'tr_xyz', reference: 'tr_xyz', hint: 'payment' })
  })
  it('returns null for a body without a valid id', async () => {
    expect(await mollieProvider.verifyWebhook('', new Headers(), { apiKey: 'test_x' })).toBeNull()
  })
})

describe('mollieProvider.testConnection', () => {
  it('flags a live key in test mode without any network call', async () => {
    const res = await mollieProvider.testConnection({ apiKey: 'live_abc' }, 'test')
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/live key/i)
  })
})
