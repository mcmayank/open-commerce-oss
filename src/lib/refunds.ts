import { formatMoney } from '@/lib/money'

/**
 * Whether a refund may proceed, and what it leaves behind.
 *
 * Pure — no Payload, no network, integer minor units. The admin action calls
 * this BEFORE it calls `provider.refund()`, so every reason to say no is
 * decided here, once, and is testable without a gateway.
 */

/**
 * Mirrors the Orders collection's `status` select. Declared here rather than
 * imported from payload-types so this module stays pure — no Payload, no
 * generated types — and can be unit-tested on its own.
 */
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type RefundContext = {
  totalMinor: number
  /** Already refunded against this order. */
  refundedMinor: number
  status: OrderStatus
  /** Set when payment was CAPTURED. Null means no money was ever taken. */
  paidAt: string | null
  /**
   * Set when payment was AUTHORIZED but not captured. `authorized` is NOT
   * `succeeded` — see PaymentOutcome in payments/core/types.ts.
   */
  authorizedAt?: string | null
  /** `refund()` is optional on PaymentProvider; only some gateways have it. */
  providerSupportsRefund: boolean
  /**
   * Paid by gift card rather than captured by the gateway. The gateway can only
   * refund what it took, so this splits the refund: real money back through the
   * gateway, voucher money back onto the card.
   */
  giftCardMinor: number
}

export type RefundDecision =
  | { ok: false; error: string }
  | {
      ok: true
      /**
       * The total refund, across BOTH tenders — this is NOT the amount to
       * send to the gateway. Sending this to `provider.refund()` is exactly
       * the over-refund this task exists to prevent; use `gatewayMinor`.
       */
      amountMinor: number
      /** What to write back to the order. */
      newRefundedTotal: number
      /** What the order's status becomes. */
      newStatus: OrderStatus
      fullyRefunded: boolean
      /** Send this through the gateway. */
      gatewayMinor: number
      /** Restore this to the gift card. */
      giftCardMinor: number
    }

/** Statuses that cannot be refunded because no sale stands behind them. */
const NOT_REFUNDABLE = new Set(['cancelled'])

export function decideRefund(ctx: RefundContext, requestedMinor: number): RefundDecision {
  if (NOT_REFUNDABLE.has(ctx.status)) {
    return { ok: false, error: `A ${ctx.status} order has no captured payment to refund.` }
  }

  // The Razorpay / PayPal auto-refund trap: an authorised payment was never
  // captured, so there is nothing to send back. Releasing it is a void, not a
  // refund, and calling refund() here would either fail or double-handle it.
  //
  // This message used to end "Cancel the order to release the authorisation
  // instead", which was false and is the reason the wording is pinned by a test
  // now. Nothing in this codebase can release an authorisation: `cancelled` is
  // an option on the Orders `status` select and nothing more — no hook, no
  // gateway call — and `PaymentProvider` declares only `refund?()`, with no
  // void capability on the interface at all. A merchant who followed that
  // sentence left their customer's money authorised while believing they had
  // released it. Do not point at an in-Niblr action again unless one exists.
  if (!ctx.paidAt && ctx.authorizedAt) {
    return {
      ok: false,
      error:
        'This payment was authorised but never captured, so there is nothing to refund. ' +
        'Void it in your gateway’s dashboard, or leave the authorisation to lapse — ' +
        'cancelling the order here only changes its status.',
    }
  }

  if (!ctx.paidAt) {
    return { ok: false, error: 'This order has not been paid, so there is nothing to refund.' }
  }

  if (!Number.isInteger(requestedMinor) || requestedMinor <= 0) {
    return { ok: false, error: 'Enter a refund amount greater than zero.' }
  }

  const remaining = Math.max(0, ctx.totalMinor - Math.max(0, ctx.refundedMinor))
  if (remaining === 0) {
    return { ok: false, error: 'This order has already been fully refunded.' }
  }
  if (requestedMinor > remaining) {
    return {
      ok: false,
      error: `That is more than the ${formatMoney(remaining, 'USD').replace(/^[^\d-]+/, '')} remaining on this order.`,
    }
  }

  const newRefundedTotal = ctx.refundedMinor + requestedMinor
  const fullyRefunded = newRefundedTotal >= ctx.totalMinor

  // Refund the customer's real money first, then the voucher portion. A partial
  // refund should return cash before it returns store credit — the reverse
  // would hand back the less useful tender and keep the better one.
  const capturedByGateway = Math.max(0, ctx.totalMinor - Math.max(0, ctx.giftCardMinor))
  const alreadyRefunded = Math.max(0, ctx.refundedMinor)
  const gatewayRemaining = Math.max(0, capturedByGateway - alreadyRefunded)
  const gatewayMinor = Math.min(requestedMinor, gatewayRemaining)
  const giftCardMinor = requestedMinor - gatewayMinor

  // The provider-capability gate only matters when THIS refund actually needs
  // to move money through the gateway. An order fully covered by a gift card
  // never touched a gateway at all (checkout clears `paymentProvider` back to
  // null for that case — see startCheckout), and a later partial refund whose
  // gateway portion is already exhausted needs nothing further from it either.
  // Checking this earlier, unconditionally, would make a fully-gift-card-paid
  // order permanently unrefundable — there is no gateway to point the merchant
  // at, and none is needed.
  if (gatewayMinor > 0 && !ctx.providerSupportsRefund) {
    return {
      ok: false,
      error:
        'This gateway does not support refunds through Niblr. Issue it from the gateway’s own dashboard, then mark the order refunded here.',
    }
  }

  return {
    ok: true,
    amountMinor: requestedMinor,
    newRefundedTotal,
    // Only a FULL refund flips the status. `orders-math` drops `refunded`
    // orders from revenue entirely, so marking a partial refund as refunded
    // would erase the whole order's value instead of the part sent back.
    // A partly-refunded delivered order is still delivered.
    newStatus: fullyRefunded ? 'refunded' : ctx.status,
    fullyRefunded,
    gatewayMinor,
    giftCardMinor,
  }
}
