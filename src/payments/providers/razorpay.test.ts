/**
 * Pure-unit tests for the Razorpay adapter helpers.
 *
 * The HMAC-SHA256 signature verification, webhook-identity extraction and
 * outcome mapping are the algorithmic pieces we can test without a live account.
 * No network calls are made.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  computeRazorpaySignature,
  safeCompareSignatures,
  extractRazorpayWebhookIdentity,
  mapRazorpayOutcome,
  razorpayProvider,
} from './razorpay'

const WEBHOOK_SECRET = 'test-webhook-secret-32byteslong!!'
const RAW_BODY = JSON.stringify({
  event: 'payment.captured',
  payload: { payment: { entity: { id: 'pay_ABC123' } } },
})

function expectedSig(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

describe('computeRazorpaySignature', () => {
  it('returns a 64-character hex string', () => {
    const sig = computeRazorpaySignature(RAW_BODY, WEBHOOK_SECRET)
    expect(sig).toHaveLength(64)
    expect(sig).toMatch(/^[0-9a-f]+$/)
  })
  it('matches an independently computed HMAC-SHA256', () => {
    expect(computeRazorpaySignature(RAW_BODY, WEBHOOK_SECRET)).toBe(expectedSig(RAW_BODY, WEBHOOK_SECRET))
  })
  it('produces different output for different bodies/secrets', () => {
    expect(computeRazorpaySignature(RAW_BODY, WEBHOOK_SECRET)).not.toBe(
      computeRazorpaySignature(RAW_BODY + ' x', WEBHOOK_SECRET),
    )
    expect(computeRazorpaySignature(RAW_BODY, WEBHOOK_SECRET)).not.toBe(
      computeRazorpaySignature(RAW_BODY, 'other'),
    )
  })
})

describe('safeCompareSignatures', () => {
  it('true for identical valid signatures', () => {
    const sig = expectedSig(RAW_BODY, WEBHOOK_SECRET)
    expect(safeCompareSignatures(sig, sig)).toBe(true)
  })
  it('false for tampered / wrong-secret / length-mismatch / empty', () => {
    const valid = expectedSig(RAW_BODY, WEBHOOK_SECRET)
    expect(safeCompareSignatures(valid, expectedSig(RAW_BODY + 'X', WEBHOOK_SECRET))).toBe(false)
    expect(safeCompareSignatures(valid, expectedSig(RAW_BODY, 'wrong'))).toBe(false)
    expect(safeCompareSignatures(valid, valid.slice(0, 32))).toBe(false)
    expect(safeCompareSignatures('', '')).toBe(false)
  })
})

describe('verifyWebhook — identity only, event id from header', () => {
  const CREDS = { keyId: 'rzp_test_x', keySecret: 'unused', webhookSecret: WEBHOOK_SECRET }
  const BODY = JSON.stringify({
    event: 'payment_link.paid',
    event_id: 'body-id-should-be-ignored',
    payload: { payment_link: { entity: { id: 'plink_ABC123' } } },
  })

  it('reads providerEventId from x-razorpay-event-id header, not the body', async () => {
    const headers = new Headers({
      'x-razorpay-signature': computeRazorpaySignature(BODY, WEBHOOK_SECRET),
      'x-razorpay-event-id': 'header-event-id-001',
    })
    const result = await razorpayProvider.verifyWebhook(BODY, headers, CREDS)
    expect(result?.providerEventId).toBe('header-event-id-001')
    expect(result?.reference).toBe('plink_ABC123')
    expect(result?.hint).toBe('payment')
  })

  it('does NOT expose amount/status (parse-don\'t-trust)', async () => {
    const headers = new Headers({
      'x-razorpay-signature': computeRazorpaySignature(BODY, WEBHOOK_SECRET),
      'x-razorpay-event-id': 'evt-1',
    })
    const result = await razorpayProvider.verifyWebhook(BODY, headers, CREDS)
    expect(Object.keys(result ?? {}).sort()).toEqual(['hint', 'providerEventId', 'reference'])
  })

  it('returns null when the signature header is missing', async () => {
    const result = await razorpayProvider.verifyWebhook(
      BODY,
      new Headers({ 'x-razorpay-event-id': 'e' }),
      CREDS,
    )
    expect(result).toBeNull()
  })

  it('returns null for an invalid signature', async () => {
    const result = await razorpayProvider.verifyWebhook(
      BODY,
      new Headers({ 'x-razorpay-signature': 'a'.repeat(64), 'x-razorpay-event-id': 'e' }),
      CREDS,
    )
    expect(result).toBeNull()
  })

  it('non-link events resolve to an empty reference (unresolvable by our index)', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_X' } } } })
    const headers = new Headers({
      'x-razorpay-signature': computeRazorpaySignature(body, WEBHOOK_SECRET),
      'x-razorpay-event-id': 'e',
    })
    expect(extractRazorpayWebhookIdentity(body, headers, WEBHOOK_SECRET)?.reference).toBe('')
  })
})

describe('mapRazorpayOutcome — authorized is NOT succeeded', () => {
  it('captured payment → succeeded', () => {
    const out = mapRazorpayOutcome(
      { amount: 25000, currency: 'INR', status: 'paid' },
      { id: 'pay_1', status: 'captured' },
    )
    expect(out.outcome).toBe('succeeded')
    expect(out.amountMinor).toBe(25000)
    expect(out.currency).toBe('INR')
    expect(out.providerPaymentId).toBe('pay_1')
  })
  it('authorized (not captured) → authorized — the auto-capture trap', () => {
    const out = mapRazorpayOutcome(
      { amount: 25000, currency: 'INR', status: 'paid' },
      { id: 'pay_2', status: 'authorized' },
    )
    expect(out.outcome).toBe('authorized')
  })
  it('failed payment → failed', () => {
    expect(mapRazorpayOutcome({ amount: 1, currency: 'INR' }, { status: 'failed' }).outcome).toBe('failed')
  })
  it('cancelled / expired link with no payment → cancelled / expired', () => {
    expect(mapRazorpayOutcome({ status: 'cancelled', amount: 1, currency: 'INR' }).outcome).toBe('cancelled')
    expect(mapRazorpayOutcome({ status: 'expired', amount: 1, currency: 'INR' }).outcome).toBe('expired')
  })
})

describe('testConnection warns about manual capture', () => {
  it('flags test key in live mode without any network call', async () => {
    const res = await razorpayProvider.testConnection(
      { keyId: 'rzp_test_abc', keySecret: 's', webhookSecret: 'w' },
      'live',
    )
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/test key/i)
  })
})
