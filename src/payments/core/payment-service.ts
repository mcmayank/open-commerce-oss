/**
 * payment-service — the ONLY module the checkout domain talks to.
 *
 * It writes the payment_attempts row (our idempotency + retry ledger and the
 * store-scoped lookup index), asks the adapter to create a hosted session, and
 * returns a provider-neutral PaymentRedirect. Checkout never touches an adapter
 * or a provider id directly.
 */
import type { Payload } from 'payload'
import type { Order } from '@/payload-types'
import type { LoadedPaymentConfig } from './config-loader'
import type { PaymentRedirect } from './types'
import { storeRef, storeIdOf } from '@/store-scope'


export interface StartAttemptInput {
  payload: Payload
  order: Order
  loaded: LoadedPaymentConfig
  /** App-generated, origin-allowlisted. Never from the client. */
  returnUrl: string
  cancelUrl: string
  /** This store+provider's webhook endpoint (app-generated). */
  webhookUrl: string
  /** OUR idempotency key for this attempt (a fresh one per retry). */
  idempotencyKey: string
  /**
   * What to actually ask the gateway for, when it differs from `order.total`.
   *
   * A gift card is tender, not a discount: `order.total` stays the full
   * invoice amount for tax purposes, and only the amount handed to the
   * provider shrinks. Defaults to `order.total` so every caller without a
   * gift card in play is unaffected.
   */
  amountMinor?: number
}

export interface StartedAttempt {
  attemptId: number | string
  redirect: PaymentRedirect
}

/**
 * Create a payment attempt + provider session for an already-created pending
 * order. A retry is simply another call with a fresh idempotencyKey — the same
 * order gains a new attempt row (never a new order).
 */
export async function startPaymentAttempt(input: StartAttemptInput): Promise<StartedAttempt> {
  const { payload, order, loaded, returnUrl, cancelUrl, webhookUrl, idempotencyKey } = input
  const tenantId = storeIdOf(order)
  if (tenantId === undefined) throw new Error('order has no store')
  const amountMinor = input.amountMinor ?? order.total

  // The invariant "never more than the invoice, never negative, always a
  // whole minor unit" currently holds because the only caller derives this
  // value correctly — but that is a fact about the caller, not about this
  // function, and it stops being true the moment a second caller exists
  // (Task 8's zero-cover path is not the risk; a future bug in either caller
  // is). A caller asking for the wrong amount is a bug worth surfacing loudly
  // via a thrown error, not one worth silently clamping into something that
  // looks like it worked.
  if (!Number.isInteger(amountMinor) || amountMinor < 0 || amountMinor > order.total) {
    throw new Error(
      `startPaymentAttempt: amountMinor (${amountMinor}) must be an integer in [0, order.total (${order.total})].`,
    )
  }

  // 1. Record the attempt (status: created) BEFORE any provider call.
  const attempt = await payload.create({
    collection: 'payment-attempts',
    data: {
      ...storeRef(tenantId),
      order: order.id,
      provider: loaded.slug,
      idempotencyKey,
      status: 'created',
      amount: amountMinor,
      currency: order.currency,
    },
    overrideAccess: true,
  })

  // 2. Create the provider session.
  let session
  try {
    session = await loaded.provider.createSession({
      order,
      amountMinor,
      currency: order.currency,
      idempotencyKey,
      returnUrl,
      cancelUrl,
      webhookUrl,
      credentials: loaded.credentials,
    })
  } catch (err) {
    await payload
      .update({
        collection: 'payment-attempts',
        id: attempt.id,
        data: { status: 'failed', failureMessage: 'createSession failed' },
        overrideAccess: true,
      })
      .catch(() => {})
    throw err
  }

  // 3. Persist the session id (our webhook lookup key) + link it to the order.
  await payload.update({
    collection: 'payment-attempts',
    id: attempt.id,
    data: { providerSessionId: session.providerSessionId, status: 'redirected' },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'orders',
    id: order.id,
    data: { paymentAttempt: attempt.id, providerRef: session.providerSessionId, paymentProvider: loaded.slug },
    overrideAccess: true,
  })

  return { attemptId: attempt.id, redirect: session.redirect }
}
