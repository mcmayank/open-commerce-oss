import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
/**
 * Pure-unit tests for the Stripe adapter helpers.
 * No network calls are made — only the local mapping functions are tested.
 */
import { describe, it, expect } from 'vitest'
import { buildStripeLineItem, mapStripeOutcome, extractStripeWebhookIdentity } from './stripe'
import type Stripe from 'stripe'
import type { Order } from '@/payload-types'

/** Minimal Order fixture — only the fields used by buildStripeLineItem. */
const baseOrder: Pick<Order, 'id' | 'orderNumber' | 'total' | 'currency'> & { tenant?: number } = {
  id: 42,
  orderNumber: 'ORD-00042',
  total: 25000, // ₹250.00 in paise
  currency: 'INR',
  tenant: 7,
}

describe('buildStripeLineItem', () => {
  it('sets unit_amount to the passed amountMinor (minor units)', () => {
    const item = buildStripeLineItem(baseOrder as Order, 25000)
    expect(item.price_data?.unit_amount).toBe(25000)
  })

  it('sets quantity to 1', () => {
    const item = buildStripeLineItem(baseOrder as Order, 25000)
    expect(item.quantity).toBe(1)
  })

  it('lowercases the currency code', () => {
    const item = buildStripeLineItem(baseOrder as Order, 25000)
    expect(item.price_data?.currency).toBe('inr')
  })

  it('uses orderNumber in the product name', () => {
    const item = buildStripeLineItem(baseOrder as Order, 25000)
    expect(item.price_data?.product_data?.name).toBe('Order ORD-00042')
  })

  it('falls back to order.id when orderNumber is null', () => {
    const order = { ...baseOrder, orderNumber: null }
    const item = buildStripeLineItem(order as Order, 25000)
    expect(item.price_data?.product_data?.name).toBe('Order 42')
  })

  it('handles USD currency', () => {
    const order = { ...baseOrder, currency: 'USD', total: 9900 }
    const item = buildStripeLineItem(order as Order, 9900)
    expect(item.price_data?.currency).toBe('usd')
    expect(item.price_data?.unit_amount).toBe(9900)
  })

  // Regression guard for the gift-card bug this function used to have: it read
  // `order.total` directly instead of the passed amount, so a gift-card order
  // was always charged the full total regardless of what the caller asked
  // Stripe to capture. `order.total` is 25000 here on purpose — if this
  // function ever goes back to deriving `unit_amount` from `order.total`
  // instead of its `amountMinor` argument, this is the test that catches it.
  it('charges amountMinor even when it differs from order.total (gift card applied)', () => {
    const item = buildStripeLineItem(baseOrder as Order, 15000)
    expect(item.price_data?.unit_amount).toBe(15000)
    expect(item.price_data?.unit_amount).not.toBe(baseOrder.total)
  })
})

describe('mapStripeOutcome', () => {
  it('paid session → succeeded with amount/currency from Stripe', () => {
    const out = mapStripeOutcome({
      payment_status: 'paid',
      amount_total: 25000,
      currency: 'inr',
      payment_intent: { id: 'pi_1', status: 'succeeded' },
    } as unknown as Stripe.Checkout.Session)
    expect(out).toMatchObject({ outcome: 'succeeded', amountMinor: 25000, currency: 'INR', providerPaymentId: 'pi_1' })
  })

  it('requires_capture payment intent → authorized (not succeeded)', () => {
    const out = mapStripeOutcome({
      payment_status: 'unpaid',
      amount_total: 5000,
      currency: 'usd',
      payment_intent: { id: 'pi_2', status: 'requires_capture' },
    } as unknown as Stripe.Checkout.Session)
    expect(out.outcome).toBe('authorized')
  })

  it('expired session → expired', () => {
    const out = mapStripeOutcome({
      payment_status: 'unpaid',
      status: 'expired',
      amount_total: 100,
      currency: 'usd',
    } as unknown as Stripe.Checkout.Session)
    expect(out.outcome).toBe('expired')
  })

  it('unpaid, still open → pending', () => {
    const out = mapStripeOutcome({
      payment_status: 'unpaid',
      status: 'open',
      amount_total: 100,
      currency: 'usd',
    } as unknown as Stripe.Checkout.Session)
    expect(out.outcome).toBe('pending')
  })
})

describe('extractStripeWebhookIdentity — identity only', () => {
  it('checkout.session.completed → payment hint + session id reference', () => {
    const id = extractStripeWebhookIdentity({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_123' } },
    } as unknown as Stripe.Event)
    expect(id).toEqual({ providerEventId: 'evt_1', reference: 'cs_123', hint: 'payment' })
  })

  it('other event types → other hint, never leak status/amount', () => {
    const id = extractStripeWebhookIdentity({
      id: 'evt_2',
      type: 'payment_intent.created',
      data: { object: { id: 'pi_9' } },
    } as unknown as Stripe.Event)
    expect(id.hint).toBe('other')
    expect(Object.keys(id).sort()).toEqual(['hint', 'providerEventId', 'reference'])
  })
})

describe('Stripe adapter — no payment_method_types', () => {
  it('session.create() call does not include payment_method_types', () => {
    // Source-level verification: payment_method_types must not appear in the
    // sessions.create() call (only in comments). This ensures Stripe uses
    // dynamic payment methods.
    const stripeSrc = readFileSync(resolve(__dirname, 'stripe.ts'), 'utf-8')

    // Extract the sessions.create(...) call block
    const createMatch = stripeSrc.match(/stripe\.checkout\.sessions\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/m)
    if (!createMatch) {
      throw new Error('Could not locate stripe.checkout.sessions.create call')
    }

    // Remove comment lines and check that payment_method_types is absent
    const paramsBody = createMatch[1]
    const nonCommentLines = paramsBody
      .split('\n')
      .filter((line: string) => {
        const trimmed = line.trim()
        return !trimmed.startsWith('//') && !trimmed.startsWith('*')
      })
      .join('\n')

    expect(nonCommentLines).not.toContain('payment_method_types')
  })
})
