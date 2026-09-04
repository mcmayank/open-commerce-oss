/**
 * Whether a gift card may be applied to an order, and for how much.
 *
 * Pure — no Payload, no network, integer minor units. The checkout action calls
 * this BEFORE it reserves any balance, so every reason to say no is decided
 * here, once, and is testable without a database. Same shape as `decideRefund`
 * in `src/lib/refunds.ts`.
 *
 * A gift card is TENDER, not a discount. Nothing here touches the taxable base:
 * the amount returned is subtracted from what the gateway is asked for, never
 * from what the customer is taxed on. Applying it as a discount would
 * understate VAT on every redemption, on an invoice Niblr issues under the
 * merchant's name.
 */
export type GiftCardLike = {
  /** Integer minor units. */
  balance: number
  /** ISO 4217, snapshotted when the card was issued. */
  currency: string
  status: 'active' | 'void'
}

export type RedemptionDecision =
  | { ok: false; error: string }
  | {
      ok: true
      /** What to subtract from the amount handed to the gateway. */
      appliedMinor: number
      /** What to write back to the card. */
      remainingBalance: number
    }

export function decideRedemption(
  card: GiftCardLike,
  orderTotalMinor: number,
  orderCurrency: string,
): RedemptionDecision {
  if (card.status !== 'active') {
    return { ok: false, error: 'That gift card is no longer valid.' }
  }

  // Refuse rather than convert. An exchange rate baked in at redemption is
  // wrong tomorrow and recorded nowhere — same posture as the catalogue import.
  if (card.currency !== orderCurrency) {
    return {
      ok: false,
      error: `Currency mismatch: that gift card is in ${card.currency} and this order is in ${orderCurrency}.`,
    }
  }

  if (!Number.isInteger(card.balance) || card.balance <= 0) {
    return { ok: false, error: 'That gift card has no balance left.' }
  }

  if (!Number.isInteger(orderTotalMinor) || orderTotalMinor <= 0) {
    return { ok: false, error: 'This order has no amount to pay.' }
  }

  const appliedMinor = Math.min(card.balance, orderTotalMinor)
  return { ok: true, appliedMinor, remainingBalance: card.balance - appliedMinor }
}
