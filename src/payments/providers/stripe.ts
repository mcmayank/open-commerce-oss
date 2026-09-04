/**
 * Stripe PaymentProvider adapter (new provider-neutral contract).
 *
 * Hosted Checkout Sessions. A single consolidated line item equal to the
 * server-computed amount is used so the charged amount ALWAYS equals what we
 * recorded — no per-line rounding drift.
 *
 * Design rules preserved from v1:
 *  - `payment_method_types` is NEVER passed (enables Stripe dynamic methods).
 *  - The SDK picks its own default API version (we do NOT pin an old one).
 *  - Secrets are never logged.
 *  - Webhook authenticity via `stripe.webhooks.constructEvent`.
 *
 * PARSE-DON'T-TRUST: `verifyWebhook` returns only the event identity; the money
 * and outcome come from `retrievePayment`, which re-fetches the session.
 */
import Stripe from 'stripe'
import type { Order } from '@/payload-types'
import type {
  CreateSessionInput,
  CreatedSession,
  Credentials,
  CredentialSchema,
  PaymentProvider,
  RetrievedPayment,
  TestConnectionResult,
  VerifiedWebhook,
} from '@/payments/core/types'
import { storeIdOf } from '@/store-scope'

/** Build the Stripe client from caller-supplied key (never cached globally). */
function makeStripe(secretKey: string): Stripe {
  return new Stripe(secretKey)
}

/**
 * Map an Order to a single Stripe line-item equal to `amountMinor`.
 *
 * `amountMinor` is a required, separate argument — NOT `order.total` — because
 * the two diverge whenever a gift card is applied as tender: `order.total`
 * stays the full invoice amount (the tax record), while `amountMinor` is what
 * the caller actually wants Stripe to capture. This function previously read
 * `order.total` directly, which silently ignored `createSession`'s
 * `amountMinor` input and charged the full total on every order regardless of
 * gift-card redemption.
 *
 * Exported so it can be unit-tested without any network calls.
 */
export function buildStripeLineItem(
  order: Pick<Order, 'id' | 'orderNumber' | 'currency'>,
  amountMinor: number,
): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    price_data: {
      currency: order.currency.toLowerCase(),
      product_data: { name: `Order ${order.orderNumber ?? order.id}` },
      unit_amount: amountMinor,
    },
    quantity: 1,
  }
}

/** Map a retrieved Checkout Session (+ expanded PaymentIntent) to our outcome. */
export function mapStripeOutcome(session: Stripe.Checkout.Session): RetrievedPayment {
  const pi =
    session.payment_intent && typeof session.payment_intent === 'object'
      ? (session.payment_intent as Stripe.PaymentIntent)
      : undefined

  const base = {
    amountMinor: session.amount_total ?? 0,
    currency: (session.currency ?? '').toUpperCase(),
    providerPaymentId: pi?.id ?? (typeof session.payment_intent === 'string' ? session.payment_intent : undefined),
  }

  // Authorized-but-not-captured (manual capture) must NOT read as succeeded.
  if (pi?.status === 'requires_capture') {
    return { ...base, outcome: 'authorized' }
  }
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
    return { ...base, outcome: 'succeeded' }
  }
  if (session.status === 'expired') {
    return { ...base, outcome: 'expired' }
  }
  if (pi?.status === 'canceled') {
    return { ...base, outcome: 'cancelled' }
  }
  if (pi?.status === 'processing' || pi?.status === 'requires_action') {
    return { ...base, outcome: 'pending' }
  }
  // unpaid / requires_payment_method and anything else: not yet paid.
  return { ...base, outcome: 'pending' }
}

/** Extract event identity from a verified Stripe event. NO money/status here. */
export function extractStripeWebhookIdentity(event: Stripe.Event): VerifiedWebhook {
  const obj = event.data.object as { id?: string }
  const isPaymentEvent =
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  return {
    providerEventId: event.id,
    reference: obj.id ?? '',
    hint: isPaymentEvent ? 'payment' : 'other',
  }
}

/** Classify a Stripe key's mode from its prefix. */
function stripeKeyMode(secretKey: string): 'test' | 'live' | 'unknown' {
  if (/^(sk|rk)_live_/.test(secretKey)) return 'live'
  if (/^(sk|rk)_test_/.test(secretKey)) return 'test'
  return 'unknown'
}

const CREDENTIAL_SCHEMA: CredentialSchema = [
  {
    name: 'secretKey',
    label: 'Secret key',
    type: 'secret',
    secret: true,
    required: true,
    help: 'Use a restricted key (rk_…) or secret key (sk_…). Stored encrypted.',
  },
  {
    name: 'publishableKey',
    label: 'Publishable key',
    type: 'text',
    help: 'Optional. Safe to expose (pk_…).',
  },
  {
    name: 'webhookSecret',
    label: 'Webhook signing secret',
    type: 'secret',
    secret: true,
    required: true,
    help: 'From your Stripe webhook endpoint (whsec_…). Stored encrypted.',
  },
]

export const stripeProvider: PaymentProvider = {
  slug: 'stripe',
  label: 'Stripe',
  region: 'Global',
  kind: 'hosted',
  credentialSchema: CREDENTIAL_SCHEMA,
  supportedCurrencies: 'all',

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    const stripe = makeStripe(input.credentials.secretKey)
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        // payment_method_types deliberately omitted — enables dynamic methods.
        line_items: [buildStripeLineItem(input.order, input.amountMinor)],
        success_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: String(input.order.id),
        metadata: {
          orderId: String(input.order.id),
          tenantId: String(storeIdOf(input.order)),
          idempotencyKey: input.idempotencyKey,
        },
      },
      { idempotencyKey: input.idempotencyKey },
    )
    if (!session.url) {
      throw new Error('Stripe Checkout Session has no URL — cannot redirect buyer')
    }
    return { providerSessionId: session.id, redirect: { kind: 'url', url: session.url } }
  },

  async verifyWebhook(rawBody: string, headers: Headers, creds: Credentials): Promise<VerifiedWebhook | null> {
    const sig = headers.get('stripe-signature')
    if (!sig) return null
    const stripe = makeStripe(creds.secretKey)
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, creds.webhookSecret)
    } catch {
      return null // invalid signature / tampered
    }
    return extractStripeWebhookIdentity(event)
  },

  async retrievePayment(reference: string, creds: Credentials): Promise<RetrievedPayment> {
    const stripe = makeStripe(creds.secretKey)
    const session = await stripe.checkout.sessions.retrieve(reference, {
      expand: ['payment_intent'],
    })
    return mapStripeOutcome(session)
  },

  async testConnection(creds: Credentials, environment?: 'test' | 'live'): Promise<TestConnectionResult> {
    const mode = stripeKeyMode(creds.secretKey)
    if (environment && mode !== 'unknown' && mode !== environment) {
      return {
        ok: false,
        message:
          mode === 'test'
            ? 'A test key is configured while Live mode is selected. Use an sk_live_/rk_live_ key or switch to Test mode.'
            : 'A live key is configured while Test mode is selected. Use an sk_test_/rk_test_ key or switch to Live mode.',
        warnings: [],
      }
    }
    try {
      const stripe = makeStripe(creds.secretKey)
      await stripe.balance.retrieve() // read-only, never charges
      return { ok: true, message: 'Connected to Stripe successfully.', warnings: [] }
    } catch (err) {
      const type = (err as { type?: string }).type
      if (type === 'StripeAuthenticationError') {
        return { ok: false, message: 'Invalid credentials — Stripe rejected the secret key.', warnings: [] }
      }
      if (type === 'StripePermissionError') {
        return { ok: false, message: 'The key is valid but restricted — grant it read access to Balance.', warnings: [] }
      }
      if (type === 'StripeConnectionError') {
        return { ok: false, message: 'Unable to contact Stripe. Try again shortly.', warnings: [] }
      }
      return { ok: false, message: 'Could not verify the Stripe connection.', warnings: [] }
    }
  },

  async refund(providerPaymentId: string, amountMinor: number, creds: Credentials): Promise<void> {
    const stripe = makeStripe(creds.secretKey)
    await stripe.refunds.create({ payment_intent: providerPaymentId, amount: amountMinor })
  },

  mapLegacyColumns(legacy) {
    return {
      secretKey: legacy.secretKey ?? '',
      webhookSecret: legacy.webhookSecret ?? '',
      publishableKey: legacy.publishableKey ?? '',
    }
  },
}
