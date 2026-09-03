/**
 * Webhook reconciliation — the authoritative "mark paid" path.
 *
 * Given a VERIFIED webhook (signature already checked, identity only), this:
 *   1. dedupes on (tenant, provider, providerEventId),
 *   2. resolves the order through OUR store-scoped payment_attempts index
 *      (never provider metadata),
 *   3. confirms the order belongs to this store,
 *   4. RE-FETCHES the payment from the provider (parse-don't-trust) — this is
 *      the sole authority for amount + outcome,
 *   5. validates currency then amount,
 *   6. acts on the outcome: `authorized` never fulfils; `succeeded` marks paid
 *      exactly once and runs the fulfilment side-effects.
 *
 * Safe audit fields only are logged (store id, order id, provider, attempt id,
 * event id, result) — never secrets or raw provider objects.
 */
import type { Payload, Where } from 'payload'
import { isDuplicateKeyError } from '@/lib/webhook-utils'
import { issueGiftCardsForOrder } from '@/lib/gift-cards/issue'
import { reverseGiftCardForOrder } from '@/lib/gift-cards/redeem'
import { sendGiftCardEmailForOrder } from '@/lib/gift-cards/email'
import type { OrderLineItem } from '@/lib/orders-math'
import { runPaidSideEffects } from './side-effects'
import type { VerifiedWebhook } from '@/payments/core/types'
import type { LoadedPaymentConfig } from '@/payments/core/config-loader'
import type { Order, PaymentAttempt } from '@/payload-types'
import { storeWhere, storeRef, storeIdOf } from '@/store-scope'

type AttemptStatus = NonNullable<PaymentAttempt['status']>

export type ReconcileStatus =
  | 'duplicate' // event already processed
  | 'unresolved' // no matching attempt (stray/test event)
  | 'store_mismatch' // attempt/order belongs to another store
  | 'currency_mismatch'
  | 'amount_mismatch'
  | 'authorized' // authorized, NOT captured — do not fulfil
  | 'not_succeeded' // failed/expired/cancelled/pending
  | 'already_paid' // idempotent no-op
  | 'paid' // marked paid + fulfilled this call

export interface ReconcileResult {
  status: ReconcileStatus
  /** Suggested HTTP status for the webhook response. */
  httpStatus: number
  outcome?: string
}

export interface ReconcileInput {
  payload: Payload
  tenant: { id: number | string }
  loaded: LoadedPaymentConfig
  verified: VerifiedWebhook
}

function result(status: ReconcileStatus, httpStatus = 200, outcome?: string): ReconcileResult {
  return { status, httpStatus, outcome }
}

function relId(v: unknown): number | string | undefined {
  if (v == null) return undefined
  if (typeof v === 'object') return (v as { id: number | string }).id
  return v as number | string
}

/** Best-effort attempt-status update — the ledger, never the money authority. */
async function setAttemptStatus(
  payload: Payload,
  attemptId: number | string,
  status: AttemptStatus,
  extra: Partial<Pick<PaymentAttempt, 'providerPaymentId' | 'failureCode' | 'failureMessage'>> = {},
): Promise<void> {
  try {
    await payload.update({
      collection: 'payment-attempts',
      id: attemptId,
      data: { status, ...extra },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[reconcile] failed to update attempt', { attemptId, status }, err)
  }
}

export async function reconcile(input: ReconcileInput): Promise<ReconcileResult> {
  const { payload, tenant, loaded, verified } = input
  const provider = loaded.slug
  const log = (result: string, extra: Record<string, unknown> = {}) =>
    console.log('[reconcile]', { store: tenant.id, provider, event: verified.providerEventId, result, ...extra })

  // ── 1. Dedupe — record this event first. Duplicate → already processed. ──
  // The (tenant, provider, providerEventId) unique index is the guarantee.
  // Payload wraps a DB unique violation as a ValidationError rather than a raw
  // 23505, so we don't guess the error shape: check existence, and on any
  // insert error re-check existence to distinguish a concurrent duplicate from
  // a genuine failure.
  const eventWhere: Where = {
    and: [
      storeWhere(tenant.id),
      { provider: { equals: provider } },
      { providerEventId: { equals: verified.providerEventId } },
    ],
  }
  const findEvent = () =>
    payload.find({ collection: 'processed-webhook-events', where: eventWhere, limit: 1, overrideAccess: true })

  if ((await findEvent()).docs.length > 0) {
    log('duplicate_ignored')
    return result('duplicate')
  }

  let processedId: number | string | undefined
  try {
    const created = await payload.create({
      collection: 'processed-webhook-events',
      data: { ...storeRef(Number(tenant.id)), provider, providerEventId: verified.providerEventId },
      overrideAccess: true,
    })
    processedId = created.id
  } catch (err) {
    if (isDuplicateKeyError(err) || (await findEvent()).docs.length > 0) {
      log('duplicate_ignored')
      return result('duplicate')
    }
    throw err
  }

  try {
    // ── 2. Resolve the order via OUR store-scoped index only ──
    if (!verified.reference) {
      log('unresolved_no_reference')
      return result('unresolved')
    }
    const { docs: attempts } = await payload.find({
      collection: 'payment-attempts',
      where: {
        and: [
          storeWhere(tenant.id),
          { provider: { equals: provider } },
          { providerSessionId: { equals: verified.reference } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    // Resolve the order via the attempt (normal path). For orders created by the
    // pre-attempt (v1) checkout that are still in flight at deploy time, fall back
    // to the legacy `providerRef` stored on the order itself. The fallback goes
    // dormant once all pre-deploy orders have settled.
    const attempt = attempts[0]
    let order: Order | null = null

    if (attempt) {
      if (processedId) {
        await payload
          .update({ collection: 'processed-webhook-events', id: processedId, data: { paymentAttempt: attempt.id }, overrideAccess: true })
          .catch(() => {})
      }
      const orderId = relId(attempt.order)
      order = orderId
        ? ((await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true }).catch(() => null)) as Order | null)
        : null
    } else {
      const { docs: legacyOrders } = await payload.find({
        collection: 'orders',
        where: { and: [storeWhere(tenant.id), { providerRef: { equals: verified.reference } }] },
        limit: 1,
        overrideAccess: true,
      })
      order = (legacyOrders[0] as Order) ?? null
      if (order) log('legacy_providerref_fallback', { order: order.id })
    }

    if (!order) {
      log('unresolved', { reference: verified.reference })
      return result('unresolved')
    }

    // Attempt-status updates are a no-op on the legacy fallback path (no attempt row).
    const markAttempt = (status: AttemptStatus, extra?: Parameters<typeof setAttemptStatus>[3]) =>
      attempt ? setAttemptStatus(payload, attempt.id, status, extra) : Promise.resolve()

    // ── 3. Store match — an order id alone is never sufficient ──
    if (String(storeIdOf(order)) !== String(tenant.id)) {
      log('store_mismatch', { attempt: attempt.id, order: order.id })
      return result('store_mismatch', 400)
    }

    // ── 4. RE-FETCH the payment (parse-don't-trust) ──
    const retrieved = await loaded.provider.retrievePayment(verified.reference, loaded.credentials)

    // ── 5. Currency then amount ──
    //
    // NEITHER of the two branches below calls `reverseGiftCardForOrder`, even
    // though both mark the attempt `failed` the same way the not_succeeded
    // branch does. Do NOT "fix" that by wiring them in — a mismatch here is
    // OUR validation rejecting what the gateway reported, not the gateway
    // itself reporting the payment as terminally over. The order is left
    // `pending`, not terminally dead, so a later, correct delivery for the
    // SAME order is exactly the case that would be broken: if this branch
    // cleared `giftCardAmount`, that later delivery would recompute
    // `expectedCapture` against the full `order.total` instead of the true
    // reduced amount and get wrongly rejected as its own amount_mismatch —
    // the exact late-capture hazard this task was asked to think through.
    // An order that lands here for real (not a transient race) needs a human
    // to look at it; there is currently no automated recovery for it, and
    // that is a known, accepted gap — not an oversight.
    if (retrieved.currency && order.currency && retrieved.currency.toUpperCase() !== order.currency.toUpperCase()) {
      await markAttempt('failed', { failureCode: 'PAYMENT_CURRENCY_MISMATCH' })
      log('currency_mismatch', { attempt: attempt?.id, order: order.id })
      return result('currency_mismatch')
    }
    // What the gateway was asked to capture. A gift card is TENDER: `order.total`
    // stays the full invoice amount and the card covers part of it, so the
    // captured amount is legitimately less. Comparing against `total` would fail
    // every gift-card order with PAYMENT_AMOUNT_MISMATCH after the money moved.
    const expectedCapture = (order.total ?? 0) - (order.giftCardAmount ?? 0)
    if (retrieved.amountMinor !== expectedCapture) {
      await markAttempt('failed', { failureCode: 'PAYMENT_AMOUNT_MISMATCH' })
      log('amount_mismatch', { attempt: attempt?.id, order: order.id })
      return result('amount_mismatch')
    }

    // ── 6. Outcome ──
    if (retrieved.outcome === 'authorized') {
      // authorized ≠ paid — do NOT fulfil. Surface it to the merchant.
      await markAttempt('authorized', { providerPaymentId: retrieved.providerPaymentId })
      await payload
        .update({ collection: 'orders', id: order.id, data: { authorizedAt: new Date().toISOString() }, overrideAccess: true })
        .catch(() => {})
      log('authorized_not_fulfilled', { attempt: attempt?.id, order: order.id })
      return result('authorized')
    }

    if (retrieved.outcome !== 'succeeded') {
      const statusMap: Record<string, AttemptStatus> = {
        failed: 'failed',
        expired: 'expired',
        cancelled: 'cancelled',
        pending: 'pending',
      }
      await markAttempt(statusMap[retrieved.outcome] ?? 'failed', {
        failureCode: retrieved.failureCode,
        failureMessage: retrieved.failureMessage,
        providerPaymentId: retrieved.providerPaymentId,
      })
      // Give any reserved gift-card balance back — but only for the TERMINAL
      // outcomes. `pending` is deliberately excluded: the payment may still
      // complete, and releasing the reservation now would let the same money
      // be spent elsewhere while this attempt is still alive. Task 6 took the
      // reservation off the card before the gateway was ever called; this is
      // its release valve for the attempt not panning out. Idempotent — a
      // redelivered failure/expiry/cancellation event for the same order
      // finds `giftCardAmount` already cleared and restores nothing twice.
      if (retrieved.outcome !== 'pending') {
        await reverseGiftCardForOrder(payload, { tenantId: tenant.id, orderId: order.id })
      }
      // `pending` is NON-terminal: the payment may still complete. Some providers
      // (e.g. Mollie) send every webhook with the SAME id and no per-event id, so
      // keeping this dedupe record would block the eventual `paid` webhook. Drop
      // it so the terminal delivery reprocesses. Terminal outcomes keep the record.
      if (retrieved.outcome === 'pending' && processedId) {
        await payload.delete({ collection: 'processed-webhook-events', id: processedId, overrideAccess: true }).catch(() => {})
      }
      log('not_succeeded', { attempt: attempt?.id, order: order.id, outcome: retrieved.outcome })
      return result('not_succeeded', 200, retrieved.outcome)
    }

    // succeeded — idempotent no-op if the order is no longer pending.
    if (order.status !== 'pending') {
      await markAttempt('succeeded', { providerPaymentId: retrieved.providerPaymentId })
      // Self-heal: the pending->paid transition is guarded by the UNIQUE
      // (tenant, providerEventId) index and can only happen once, but minting
      // is a separate step after it and can fail independently (e.g. this
      // process died halfway through a multi-card order, after the order was
      // already marked paid). Every later delivery of the same webhook lands
      // here, so retry issuance on each one. `issueGiftCardsForOrder` is
      // idempotent — it mints only whatever is still short — so this is a
      // no-op for every order with no gift-card lines or that already has all
      // its cards, and only does work for the genuinely stuck case.
      const healedCards = await issueGiftCardsForOrder(payload, {
        id: order.id,
        storeId: tenant.id,
        currency: order.currency,
        lineItems: order.lineItems as unknown as OrderLineItem[],
        giftCardRecipientName: order.giftCardRecipientName,
        giftCardRecipientEmail: order.giftCardRecipientEmail,
        giftCardMessage: order.giftCardMessage,
      })
      // Deliver only the cards THIS call minted. `issueGiftCardsForOrder` is
      // idempotent and returns codes solely for its own shortfall, so a
      // self-heal that finds nothing outstanding gets `[]` back and sends
      // nothing — the normal case, since minting almost always already
      // completed on the first delivery. `sendGiftCardEmailForOrder` itself
      // no-ops without a recipient address and never throws.
      if (healedCards.length > 0) {
        await sendGiftCardEmailForOrder(payload, {
          tenantId: tenant.id,
          orderId: order.id,
          currency: order.currency,
          cards: healedCards,
          recipientEmail: order.giftCardRecipientEmail,
          recipientName: order.giftCardRecipientName,
          message: order.giftCardMessage,
        })
      }
      log('already_paid', { attempt: attempt?.id, order: order.id, giftCards: healedCards.length })
      return result('already_paid')
    }

    // ── 7. Mark paid EXACTLY ONCE. UNIQUE(tenant, providerEventId) on orders is
    //     the concurrency backstop against simultaneous deliveries. ──
    try {
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: {
          status: 'paid',
          paidAt: new Date().toISOString(),
          providerEventId: verified.providerEventId,
          providerRef: attempt?.providerSessionId ?? order.providerRef ?? verified.reference,
          paymentProvider: provider,
          ...(attempt ? { paymentAttempt: attempt.id } : {}),
        },
        overrideAccess: true,
      })
    } catch (err) {
      // A concurrent delivery may have already marked it paid. The UNIQUE
      // (tenant, providerEventId) index on orders is the backstop; Payload wraps
      // it as a ValidationError, so re-check the order status rather than the
      // error shape.
      const recheck = (await payload
        .findByID({ collection: 'orders', id: order.id, overrideAccess: true })
        .catch(() => null)) as Order | null
      if (isDuplicateKeyError(err) || (recheck && recheck.status !== 'pending')) {
        await markAttempt('succeeded', { providerPaymentId: retrieved.providerPaymentId })
        log('already_paid_concurrent', { attempt: attempt?.id, order: order.id })
        return result('already_paid')
      }
      throw err
    }

    // Mint any gift cards this order bought. Placed AFTER the try/catch above
    // (not inside it, despite that being the more obvious spot) so a failure
    // here can never be mistaken by that catch's duplicate-key recheck for a
    // concurrent "already paid" delivery and get silently swallowed. We are
    // past the point where `payload.update` has committed `status: 'paid'` —
    // the UNIQUE (tenant, providerEventId) index plus the pending-check above
    // mean this line runs exactly once per order, so a replayed webhook can
    // never mint twice. Deliberately does NOT re-check plan entitlement: the
    // customer already paid, so the card is owed regardless of the merchant's
    // current plan.
    const issuedCards = await issueGiftCardsForOrder(payload, {
      id: order.id,
      storeId: tenant.id,
      currency: order.currency,
      lineItems: order.lineItems as unknown as OrderLineItem[],
      giftCardRecipientName: order.giftCardRecipientName,
      giftCardRecipientEmail: order.giftCardRecipientEmail,
      giftCardMessage: order.giftCardMessage,
    })

    // Best-effort — a delivery failure must not roll back the paid order or
    // the cards just minted above. `sendGiftCardEmailForOrder` never throws
    // and no-ops when there is nothing to send or no address to send it to.
    if (issuedCards.length > 0) {
      await sendGiftCardEmailForOrder(payload, {
        tenantId: tenant.id,
        orderId: order.id,
        currency: order.currency,
        cards: issuedCards,
        recipientEmail: order.giftCardRecipientEmail,
        recipientName: order.giftCardRecipientName,
        message: order.giftCardMessage,
      })
    }

    await markAttempt('succeeded', { providerPaymentId: retrieved.providerPaymentId })

    // ── 8. Fulfilment side-effects, exactly once ──
    const paidOrder = (await payload.findByID({ collection: 'orders', id: order.id, overrideAccess: true })) as Order
    await runPaidSideEffects(payload, tenant.id, paidOrder)

    log('paid', { attempt: attempt?.id, order: order.id, giftCards: issuedCards.length })
    return result('paid')
  } catch (err) {
    // A transient failure — roll back the dedupe record so the provider retry
    // reprocesses this event (otherwise a paid order could be missed).
    if (processedId) {
      await payload.delete({ collection: 'processed-webhook-events', id: processedId, overrideAccess: true }).catch(() => {})
    }
    throw err
  }
}
