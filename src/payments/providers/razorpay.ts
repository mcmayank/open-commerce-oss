/**
 * Razorpay PaymentProvider adapter (new provider-neutral contract).
 *
 * Hosted redirect via the Payment Links API (`paymentLink.create` → `short_url`).
 * Webhook signature is HMAC-SHA256 of the raw body with the webhook secret,
 * compared in constant time to `x-razorpay-signature`.
 *
 * PARSE-DON'T-TRUST: `verifyWebhook` only verifies the signature and extracts
 * the event identity (the payment-link id). `retrievePayment` re-fetches the
 * link/payment and is the sole authority for money + outcome — including the
 * authorized-but-not-captured case (the auto-capture trap) which maps to
 * `authorized`, never `succeeded`.
 *
 * NOTE: built against the documented Razorpay Node SDK (razorpay@2.x); not yet
 * end-to-end verified against Razorpay's sandbox. Assumptions are flagged.
 */
import Razorpay from 'razorpay'
import type { PaymentLinks } from 'razorpay/dist/types/paymentLink'
import { createHmac, timingSafeEqual } from 'crypto'
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

/** Build a Razorpay client from caller-supplied keys. */
function makeRazorpay(creds: Credentials): Razorpay {
  return new Razorpay({ key_id: creds.keyId ?? '', key_secret: creds.keySecret ?? '' })
}

/** Expected HMAC-SHA256 signature for a Razorpay webhook payload. Exported for tests. */
export function computeRazorpaySignature(rawBody: string, webhookSecret: string): string {
  return createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
}

/** Constant-time comparison of two hex signature strings. Exported for tests. */
export function safeCompareSignatures(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

type RzpEntity = Record<string, unknown>

/** Map a fetched payment link (+ its latest payment) to our outcome. Exported for tests. */
export function mapRazorpayOutcome(link: RzpEntity, payment?: RzpEntity): RetrievedPayment {
  const amountMinor = Number(link.amount ?? payment?.amount ?? 0)
  const currency = String(link.currency ?? payment?.currency ?? '').toUpperCase()
  const providerPaymentId = payment?.id ? String(payment.id) : undefined
  const base = { amountMinor, currency, providerPaymentId }

  const paymentStatus = payment?.status ? String(payment.status) : undefined
  // The underlying payment status is the real authority.
  if (paymentStatus === 'captured') return { ...base, outcome: 'succeeded' }
  if (paymentStatus === 'authorized') return { ...base, outcome: 'authorized' } // auto-capture trap
  if (paymentStatus === 'refunded') return { ...base, outcome: 'succeeded' } // paid then refunded (observation)
  if (paymentStatus === 'failed') return { ...base, outcome: 'failed' }

  // Fall back to the link status when no payment is attached yet.
  const linkStatus = String(link.status ?? '')
  if (linkStatus === 'paid') return { ...base, outcome: 'succeeded' }
  if (linkStatus === 'cancelled') return { ...base, outcome: 'cancelled' }
  if (linkStatus === 'expired') return { ...base, outcome: 'expired' }
  return { ...base, outcome: 'pending' }
}

/** Verify signature + parse identity from a Razorpay webhook. Exported for tests. */
export function extractRazorpayWebhookIdentity(
  rawBody: string,
  headers: Headers,
  webhookSecret: string,
): VerifiedWebhook | null {
  const receivedSig = headers.get('x-razorpay-signature')
  if (!receivedSig) return null
  const expectedSig = computeRazorpaySignature(rawBody, webhookSecret)
  if (!safeCompareSignatures(expectedSig, receivedSig)) return null

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return null
  }

  const eventType = body.event as string | undefined
  // Razorpay sends the unique event id in a header, not the body.
  const providerEventId = headers.get('x-razorpay-event-id') ?? ''
  const payloadObj = (body.payload as Record<string, unknown>) ?? {}

  // The payment-link id (plink_…) is our lookup key (matches providerSessionId).
  if (eventType === 'payment_link.paid') {
    const pl = (payloadObj.payment_link as Record<string, unknown> | undefined) ?? {}
    const entity = (pl.entity as Record<string, unknown> | undefined) ?? {}
    return { providerEventId, reference: String(entity.id ?? ''), hint: 'payment' }
  }

  // Other events (payment.captured/authorized/etc.) reference a pay_… id which is
  // not our session key; acknowledge without a resolvable reference.
  return { providerEventId, reference: '', hint: 'other' }
}

/** Classify a Razorpay key's mode from its key_id prefix. */
function razorpayKeyMode(keyId: string): 'test' | 'live' | 'unknown' {
  if (/^rzp_live_/.test(keyId)) return 'live'
  if (/^rzp_test_/.test(keyId)) return 'test'
  return 'unknown'
}

const CREDENTIAL_SCHEMA: CredentialSchema = [
  {
    name: 'keyId',
    label: 'Key ID',
    type: 'text',
    required: true,
    help: 'Your Razorpay key_id (rzp_test_… / rzp_live_…). Safe to expose.',
  },
  {
    name: 'keySecret',
    label: 'Key secret',
    type: 'secret',
    secret: true,
    required: true,
    help: 'Your Razorpay key_secret. Stored encrypted.',
  },
  {
    name: 'webhookSecret',
    label: 'Webhook secret',
    type: 'secret',
    secret: true,
    required: true,
    help: 'The secret you set when creating the webhook. Stored encrypted.',
  },
]

export const razorpayProvider: PaymentProvider = {
  slug: 'razorpay',
  label: 'Razorpay',
  region: 'India',
  kind: 'hosted',
  credentialSchema: CREDENTIAL_SCHEMA,
  supportedCurrencies: 'all',

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    const rzp = makeRazorpay(input.credentials)
    const params: PaymentLinks.RazorpayPaymentLinkCreateRequestBody = {
      amount: input.amountMinor,
      currency: input.currency,
      description: `Order ${input.order.orderNumber ?? input.order.id}`,
      callback_url: input.returnUrl,
      callback_method: 'get',
      customer: {
        name: input.order.shippingAddress?.name ?? '',
        email: input.order.email ?? '',
        contact: input.order.shippingAddress?.phone ?? '',
      },
      notes: {
        orderId: String(input.order.id),
        tenantId: String(storeIdOf(input.order)),
        idempotencyKey: input.idempotencyKey,
      },
    }
    const link = await rzp.paymentLink.create(params)
    return {
      providerSessionId: String(link.id),
      redirect: { kind: 'url', url: String(link.short_url) },
    }
  },

  async verifyWebhook(rawBody: string, headers: Headers, creds: Credentials): Promise<VerifiedWebhook | null> {
    return extractRazorpayWebhookIdentity(rawBody, headers, creds.webhookSecret)
  },

  async retrievePayment(reference: string, creds: Credentials): Promise<RetrievedPayment> {
    const rzp = makeRazorpay(creds)
    // Fetch the payment link; it carries amount/currency/status and (once paid)
    // the associated payment id(s).
    const link = (await rzp.paymentLink.fetch(reference)) as unknown as RzpEntity
    let payment: RzpEntity | undefined
    const payments = link.payments as Array<Record<string, unknown>> | undefined
    const paymentId = Array.isArray(payments) && payments[0]?.payment_id
      ? String(payments[0].payment_id)
      : undefined
    if (paymentId) {
      payment = (await rzp.payments.fetch(paymentId)) as unknown as RzpEntity
    }
    return mapRazorpayOutcome(link, payment)
  },

  async testConnection(creds: Credentials, environment?: 'test' | 'live'): Promise<TestConnectionResult> {
    const mode = razorpayKeyMode(creds.keyId ?? '')
    if (environment && mode !== 'unknown' && mode !== environment) {
      return {
        ok: false,
        message:
          mode === 'test'
            ? 'A test key_id is configured while Live mode is selected. Use an rzp_live_ key or switch to Test mode.'
            : 'A live key_id is configured while Test mode is selected. Use an rzp_test_ key or switch to Live mode.',
        warnings: [],
      }
    }
    // Razorpay does not expose the account auto-capture setting via a read-only
    // API call, so we surface a proactive warning rather than a detected one.
    const warnings = [
      'Verify Auto-Capture is ON in your Razorpay dashboard (Settings → Payment Capture). ' +
        'If it is off, payments are only AUTHORIZED and will auto-refund — orders will not be fulfilled.',
    ]
    try {
      const rzp = makeRazorpay(creds)
      // Read-only: list a single payment to validate the key pair.
      await (rzp.payments.all as unknown as (o: { count: number }) => Promise<unknown>)({ count: 1 })
      return { ok: true, message: 'Connected to Razorpay successfully.', warnings }
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 401) {
        return { ok: false, message: 'Invalid credentials — Razorpay rejected the key_id/key_secret.', warnings: [] }
      }
      return { ok: false, message: 'Could not verify the Razorpay connection.', warnings: [] }
    }
  },

  async refund(providerPaymentId: string, amountMinor: number, creds: Credentials): Promise<void> {
    const rzp = makeRazorpay(creds)
    await rzp.payments.refund(providerPaymentId, { amount: amountMinor })
  },

  mapLegacyColumns(legacy) {
    // v1 stored Razorpay key_id in publishableKey and key_secret in secretKey.
    return {
      keyId: legacy.publishableKey ?? '',
      keySecret: legacy.secretKey ?? '',
      webhookSecret: legacy.webhookSecret ?? '',
    }
  },
}
