import { describe, expect, it } from 'vitest'
import { listProviders } from '@/payments/core/provider-registry'
import { paymentRails, railCount, railNames } from './payment-rails'

describe('payment rails derive from the registry', () => {
  it('exposes every registered provider, none dropped', () => {
    expect(railCount()).toBe(listProviders().length)
    expect(paymentRails().map((r) => r.slug).sort()).toEqual(
      listProviders().map((p) => p.slug).sort(),
    )
  })

  it('gives every rail a region for the marketing list', () => {
    for (const rail of paymentRails()) {
      expect(rail.region, `${rail.slug} has no region`).toBeTruthy()
    }
  })

  it('reports refund support from the adapter, not from a hardcoded list', () => {
    const byslug = new Map(listProviders().map((p) => [p.slug, p]))
    for (const rail of paymentRails()) {
      expect(rail.hasRefundApi).toBe(typeof byslug.get(rail.slug)?.refund === 'function')
    }
  })

  it('marks offline as a real rail rather than hiding it', () => {
    const offline = paymentRails().find((r) => r.slug === 'offline')
    expect(offline).toBeDefined()
    expect(offline?.isOffline).toBe(true)
    // Cash on delivery and bank transfer are how a large share of GCC and India
    // orders are actually paid. It is a rail, not an absence of one.
    expect(offline?.readiness).toBe('live')
  })

  it('never marks a rail live just because its adapter exists', () => {
    // The four regional rails are implemented and tested but have not been run
    // against the real provider API. Promoting one here without exercising it
    // is the understatement-to-overstatement swap this module exists to prevent.
    for (const slug of ['mollie', 'paystack', 'flutterwave', 'xendit']) {
      const rail = paymentRails().find((r) => r.slug === slug)
      expect(rail?.readiness, `${slug} claims production use`).toBe('built')
    }
  })

  it('formats rail names as a readable list', () => {
    expect(railNames([{ label: 'Stripe' }] as never)).toBe('Stripe')
    expect(railNames([{ label: 'Stripe' }, { label: 'Razorpay' }] as never)).toBe(
      'Stripe and Razorpay',
    )
    expect(
      railNames([{ label: 'A' }, { label: 'B' }, { label: 'C' }] as never),
    ).toBe('A, B and C')
  })
})
