/**
 * Paystack PaymentProvider adapter (thin fetch, no SDK).
 *
 * Hosted checkout via Transaction Initialize (`authorization_url`). Activation is
 * a single secret key (`sk_test_…` / `sk_live_…`) — the webhook is signed with
 * that SAME key (HMAC-SHA512), so there's nothing extra to paste.
 *
 * PARSE-DON'T-TRUST: verifyWebhook only checks the signature + extracts identity;
 * retrievePayment calls the Verify endpoint for the authoritative amount/status.
 *
 * Paystack amounts are integer minor units (kobo/pesewas/cents) — same as ours.
 *
 * NOTE: built to Paystack's documented API; not sandbox-verified in this change.
 */
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

const API = 'https://api.paystack.co'

/** HMAC-SHA512 of the raw body with the secret key. Exported for tests. */
export function computePaystackSignature(rawBody: string, secretKey: string): string {
  return createHmac('sha512', secretKey).update(rawBody).digest('hex')
}

/** Constant-time hex comparison. Exported for tests. */
export function safeCompareHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Verify signature + extract identity from a Paystack webhook. Exported for tests. */
export function extractPaystackWebhookIdentity(
  rawBody: string,
  headers: Headers,
  secretKey: string,
): VerifiedWebhook | null {
  const sig = headers.get('x-paystack-signature')
  if (!sig) return null
  if (!safeCompareHex(computePaystackSignature(rawBody, secretKey), sig)) return null
  let body: { event?: string; data?: { id?: number | string; reference?: string } }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return null
  }
  const reference = body.data?.reference ?? ''
  const eventId = body.data?.id != null ? String(body.data.id) : reference
  const hint = body.event === 'charge.success' ? 'payment' : 'other'
  return { providerEventId: eventId, reference, hint }
}

/** Map a Paystack transaction status to our outcome. Exported for tests. */
export function mapPaystackStatus(status: string): RetrievedPayment['outcome'] {
  switch (status) {
    case 'success':
      return 'succeeded'
    case 'failed':
      return 'failed'
    case 'abandoned':
      return 'cancelled'
    case 'reversed':
      return 'cancelled'
    default:
      return 'pending'
  }
}

function keyMode(secretKey: string): 'test' | 'live' | 'unknown' {
  if (/^sk_live_/.test(secretKey)) return 'live'
  if (/^sk_test_/.test(secretKey)) return 'test'
  return 'unknown'
}

const CREDENTIAL_SCHEMA: CredentialSchema = [
  {
    name: 'secretKey',
    label: 'Secret key',
    type: 'secret',
    secret: true,
    required: true,
    help: 'Your Paystack secret key (sk_test_… / sk_live_…). Also signs your webhooks. Stored encrypted.',
  },
]

async function paystackFetch(secretKey: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export const paystackProvider: PaymentProvider = {
  slug: 'paystack',
  label: 'Paystack',
  region: 'Africa',
  kind: 'hosted',
  credentialSchema: CREDENTIAL_SCHEMA,
  supportedCurrencies: ['NGN', 'GHS', 'ZAR', 'USD', 'KES'],

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    const res = await paystackFetch(input.credentials.secretKey, '/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.order.email ?? 'customer@example.com',
        amount: input.amountMinor,
        currency: input.currency,
        reference: input.idempotencyKey,
        callback_url: input.returnUrl,
        metadata: { orderId: String(input.order.id), tenantId: String(storeIdOf(input.order)) },
      }),
    })
    if (!res.ok) throw new Error(`Paystack initialize failed: ${res.status}`)
    const data = (await res.json()) as { data?: { authorization_url?: string; reference?: string } }
    const url = data.data?.authorization_url
    const reference = data.data?.reference ?? input.idempotencyKey
    if (!url) throw new Error('Paystack returned no authorization_url')
    return { providerSessionId: reference, redirect: { kind: 'url', url } }
  },

  async verifyWebhook(rawBody: string, headers: Headers, creds: Credentials): Promise<VerifiedWebhook | null> {
    return extractPaystackWebhookIdentity(rawBody, headers, creds.secretKey)
  },

  async retrievePayment(reference: string, creds: Credentials): Promise<RetrievedPayment> {
    const res = await paystackFetch(creds.secretKey, `/transaction/verify/${encodeURIComponent(reference)}`)
    if (!res.ok) throw new Error(`Paystack verify failed: ${res.status}`)
    const data = (await res.json()) as {
      data?: { status?: string; amount?: number; currency?: string; id?: number | string }
    }
    const d = data.data ?? {}
    return {
      outcome: mapPaystackStatus(d.status ?? ''),
      amountMinor: Number(d.amount ?? 0),
      currency: (d.currency ?? '').toUpperCase(),
      providerPaymentId: d.id != null ? String(d.id) : undefined,
    }
  },

  async testConnection(creds: Credentials, environment?: 'test' | 'live'): Promise<TestConnectionResult> {
    const mode = keyMode(creds.secretKey ?? '')
    if (environment && mode !== 'unknown' && mode !== environment) {
      return {
        ok: false,
        message: `A ${mode} key is configured while ${environment === 'live' ? 'Live' : 'Test'} mode is selected. Use an sk_${environment}_ key or switch modes.`,
        warnings: [],
      }
    }
    try {
      const res = await paystackFetch(creds.secretKey, '/transaction?perPage=1')
      if (res.status === 401) return { ok: false, message: 'Invalid credentials — Paystack rejected the secret key.', warnings: [] }
      if (!res.ok) return { ok: false, message: 'Could not verify the Paystack connection.', warnings: [] }
      return { ok: true, message: 'Connected to Paystack successfully.', warnings: [] }
    } catch {
      return { ok: false, message: 'Unable to contact Paystack. Try again shortly.', warnings: [] }
    }
  },
}
