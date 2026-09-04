import { describe, expect, it } from 'vitest'
import { decideRefund, type RefundContext } from './refunds'

/**
 * Refunds move real money out of a merchant's account, and the admin will call
 * this before it calls the provider. Every amount is integer minor units.
 */

const paidOrder = (over: Partial<RefundContext> = {}): RefundContext => ({
  totalMinor: 10000,
  refundedMinor: 0,
  status: 'paid',
  paidAt: '2026-07-20T10:00:00.000Z',
  authorizedAt: null,
  providerSupportsRefund: true,
  giftCardMinor: 0,
  ...over,
})

describe('decideRefund — happy paths', () => {
  it('allows a full refund and moves the order to refunded', () => {
    expect(decideRefund(paidOrder(), 10000)).toEqual({
      ok: true,
      amountMinor: 10000,
      newRefundedTotal: 10000,
      newStatus: 'refunded',
      fullyRefunded: true,
      gatewayMinor: 10000,
      giftCardMinor: 0,
    })
  })

  it('allows a partial refund and leaves the status alone', () => {
    // Critical: `refunded` is excluded from revenue in full by orders-math, so
    // marking a partial refund as refunded would erase the whole order's value.
    expect(decideRefund(paidOrder(), 2500)).toEqual({
      ok: true,
      amountMinor: 2500,
      newRefundedTotal: 2500,
      newStatus: 'paid',
      fullyRefunded: false,
      gatewayMinor: 2500,
      giftCardMinor: 0,
    })
  })

  it('tops up an earlier partial refund to the full amount', () => {
    expect(decideRefund(paidOrder({ refundedMinor: 2500 }), 7500)).toEqual({
      ok: true,
      amountMinor: 7500,
      newRefundedTotal: 10000,
      newStatus: 'refunded',
      fullyRefunded: true,
      gatewayMinor: 7500,
      giftCardMinor: 0,
    })
  })

  it('keeps a fulfilment status through a partial refund', () => {
    // A delivered order that is partly refunded is still delivered.
    expect(decideRefund(paidOrder({ status: 'delivered' }), 1000)).toMatchObject({
      ok: true,
      newStatus: 'delivered',
    })
  })
})

describe('decideRefund — guards', () => {
  it('refuses to refund more than remains', () => {
    const r = decideRefund(paidOrder({ refundedMinor: 8000 }), 2500)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/2,?500|remaining|more than/i)
  })

  it('refuses a second full refund', () => {
    const r = decideRefund(paidOrder({ refundedMinor: 10000, status: 'refunded' }), 1)
    expect(r.ok).toBe(false)
  })

  it('refuses zero and negative amounts', () => {
    expect(decideRefund(paidOrder(), 0).ok).toBe(false)
    expect(decideRefund(paidOrder(), -500).ok).toBe(false)
  })

  it('refuses a fractional minor unit', () => {
    expect(decideRefund(paidOrder(), 12.5).ok).toBe(false)
  })

  it('refuses when the order was never paid', () => {
    const r = decideRefund(paidOrder({ paidAt: null, status: 'pending' }), 1000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/not been paid|never paid|no payment/i)
  })

  it('refuses an authorized-but-uncaptured payment', () => {
    // The Razorpay/PayPal auto-refund trap: `authorized` is NOT `succeeded`.
    // Money was never captured, so there is nothing to send back — voiding an
    // authorisation is a different operation from refunding a capture.
    const r = decideRefund(
      paidOrder({ paidAt: null, authorizedAt: '2026-07-20T10:00:00.000Z', status: 'pending' }),
      1000,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/authori[sz]ed/i)
  })

  it('does not tell the merchant that cancelling releases the authorisation', () => {
    // Regression guard on the REMEDY, not just the diagnosis. This message
    // previously ended "Cancel the order to release the authorisation instead",
    // which is false: `cancelled` is an option on the Orders `status` select
    // and nothing else, and `PaymentProvider` has no void capability to call.
    // The assertion above passes happily on either wording — matching only
    // /authori[sz]ed/ is exactly how the wrong instruction survived — so the
    // fix is pinned here instead.
    const r = decideRefund(
      paidOrder({ paidAt: null, authorizedAt: '2026-07-20T10:00:00.000Z', status: 'pending' }),
      1000,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).not.toMatch(/cancel[^.]*releas/i)
      // Points at the only place the money can actually be released.
      expect(r.error).toMatch(/gateway/i)
    }
  })

  it('refuses when the provider cannot refund', () => {
    // `refund()` is optional on the PaymentProvider interface — only Stripe and
    // Razorpay implement it today.
    const r = decideRefund(paidOrder({ providerSupportsRefund: false }), 1000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/does not support|gateway/i)
  })

  it('refuses to refund a cancelled order', () => {
    expect(decideRefund(paidOrder({ status: 'cancelled' }), 1000).ok).toBe(false)
  })
})

describe('decideRefund — gift card tender', () => {
  it('splits a full refund between the gateway and the card', () => {
    // 5000 order: 3000 paid by gift card, 2000 captured by the gateway.
    const r = decideRefund(paidOrder({ totalMinor: 5000, giftCardMinor: 3000 }), 5000)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.gatewayMinor).toBe(2000)
      expect(r.giftCardMinor).toBe(3000)
      expect(r.gatewayMinor + r.giftCardMinor).toBe(5000)
    }
  })

  it('never asks the gateway for more than it captured', () => {
    for (const requested of [500, 2000, 3500, 5000]) {
      const r = decideRefund(paidOrder({ totalMinor: 5000, giftCardMinor: 3000 }), requested)
      // Assert success first: a regression that made decideRefund refuse
      // everything would otherwise leave this loop with nothing to check and
      // pass vacuously.
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.gatewayMinor).toBeLessThanOrEqual(2000)
    }
  })

  it('takes a partial refund from the gateway portion first', () => {
    // The customer's real money goes back before the voucher does.
    const r = decideRefund(paidOrder({ totalMinor: 5000, giftCardMinor: 3000 }), 1500)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.gatewayMinor).toBe(1500)
      expect(r.giftCardMinor).toBe(0)
    }
  })

  it('spills into the card once the gateway portion is exhausted', () => {
    const r = decideRefund(paidOrder({ totalMinor: 5000, giftCardMinor: 3000 }), 4000)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.gatewayMinor).toBe(2000)
      expect(r.giftCardMinor).toBe(2000)
    }
  })

  it('is unchanged for an order with no gift card', () => {
    const r = decideRefund(paidOrder({ totalMinor: 5000, giftCardMinor: 0 }), 5000)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.gatewayMinor).toBe(5000)
      expect(r.giftCardMinor).toBe(0)
    }
  })

  it('refunds a fully gift-card-covered order even when the provider cannot refund', () => {
    // Checkout clears `paymentProvider` to null for an order the gift card
    // covers completely, so `providerSupportsRefund` is false here in
    // practice — but the gateway is never touched, so that must not block it.
    const r = decideRefund(
      paidOrder({ totalMinor: 5000, giftCardMinor: 5000, providerSupportsRefund: false }),
      5000,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.gatewayMinor).toBe(0)
      expect(r.giftCardMinor).toBe(5000)
    }
  })

  it('does not need the gateway once its portion is already refunded, even if it cannot refund', () => {
    // First 2000 already went back through the gateway; only the 3000 gift
    // card portion remains. That portion never touches the gateway, so a
    // provider that cannot refund must not block it either.
    const r = decideRefund(
      paidOrder({
        totalMinor: 5000,
        giftCardMinor: 3000,
        refundedMinor: 2000,
        providerSupportsRefund: false,
      }),
      3000,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.gatewayMinor).toBe(0)
      expect(r.giftCardMinor).toBe(3000)
    }
  })

  it('computes each partial refund in a sequence correctly against an UNCHANGED giftCardMinor', () => {
    // decideRefund is pure — it has no order to mutate — so this pins the
    // contract the /:id/refund endpoint must honour: giftCardAmount is the
    // tender split, not a running balance, so every call in the sequence
    // passes the SAME giftCardMinor (3000) and only refundedMinor advances.
    // 5000 order, 3000 on the card, 2000 captured by the gateway. Refund
    // 1500, then 1500, then 2000 — the compounding case from review.
    const totalMinor = 5000
    const giftCardMinor = 3000
    let refundedMinor = 0

    const first = decideRefund(paidOrder({ totalMinor, giftCardMinor, refundedMinor }), 1500)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.gatewayMinor).toBe(1500)
    expect(first.giftCardMinor).toBe(0)
    refundedMinor = first.newRefundedTotal

    const second = decideRefund(paidOrder({ totalMinor, giftCardMinor, refundedMinor }), 1500)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.gatewayMinor).toBe(500)
    expect(second.giftCardMinor).toBe(1000)
    refundedMinor = second.newRefundedTotal

    const third = decideRefund(paidOrder({ totalMinor, giftCardMinor, refundedMinor }), 2000)
    expect(third.ok).toBe(true)
    if (!third.ok) return
    expect(third.gatewayMinor).toBe(0)
    expect(third.giftCardMinor).toBe(2000)
    refundedMinor = third.newRefundedTotal

    expect(refundedMinor).toBe(totalMinor)
    expect(first.gatewayMinor + second.gatewayMinor + third.gatewayMinor).toBe(2000) // = capturedByGateway, never exceeded
    expect(first.giftCardMinor + second.giftCardMinor + third.giftCardMinor).toBe(3000) // = giftCardMinor

    // Now show WHY giftCardAmount must not be cleared: replaying the same
    // sequence but zeroing it after the first refund (what
    // `reverseGiftCardForOrder` does, and exactly what this endpoint must
    // NOT do) makes the second refund think the whole order was gateway
    // money, and it sends more to the gateway than was ever captured.
    const wrongSecond = decideRefund(
      paidOrder({ totalMinor, giftCardMinor: 0, refundedMinor: first.newRefundedTotal }),
      1500,
    )
    expect(wrongSecond.ok).toBe(true)
    if (!wrongSecond.ok) return
    expect(wrongSecond.gatewayMinor).toBe(1500) // correct answer was 500 — over-refund
    expect(wrongSecond.gatewayMinor).toBeGreaterThan(2000 - first.gatewayMinor)
  })
})

describe('decideRefund — invariants', () => {
  it('never lets the refunded total exceed the order total', () => {
    for (let already = 0; already <= 10000; already += 1250) {
      for (const req of [1, 999, 2500, 10000]) {
        const r = decideRefund(paidOrder({ refundedMinor: already }), req)
        if (r.ok) expect(r.newRefundedTotal).toBeLessThanOrEqual(10000)
      }
    }
  })

  it('only reports refunded status when nothing remains', () => {
    for (let already = 0; already <= 9000; already += 1000) {
      for (const req of [1, 500, 1000, 10000 - already]) {
        const r = decideRefund(paidOrder({ refundedMinor: already }), req)
        if (r.ok) {
          expect(r.newStatus === 'refunded').toBe(r.newRefundedTotal === 10000)
          expect(r.fullyRefunded).toBe(r.newRefundedTotal === 10000)
        }
      }
    }
  })
})
