import { describe, it, expect } from 'vitest'
import { getProvider, requireProvider, listProviders } from './provider-registry'
import { isPaymentError } from './errors'

describe('provider-registry', () => {
  it('resolves the built-in providers', () => {
    expect(getProvider('stripe')?.slug).toBe('stripe')
    expect(getProvider('razorpay')?.slug).toBe('razorpay')
    expect(getProvider('offline')?.slug).toBe('offline')
  })

  it('returns null for an unknown slug', () => {
    expect(getProvider('paypal')).toBeNull()
  })

  it('requireProvider throws PROVIDER_NOT_FOUND for an unknown slug', () => {
    try {
      requireProvider('nope')
      throw new Error('expected throw')
    } catch (err) {
      expect(isPaymentError(err)).toBe(true)
      expect((err as { code: string }).code).toBe('PROVIDER_NOT_FOUND')
    }
  })

  it('lists all registered providers and every one exposes a credentialSchema', () => {
    const providers = listProviders()
    expect(providers.length).toBeGreaterThanOrEqual(3)
    for (const p of providers) {
      expect(Array.isArray(p.credentialSchema)).toBe(true)
      expect(typeof p.slug).toBe('string')
    }
  })
})
