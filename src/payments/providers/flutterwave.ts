/**
 * Flutterwave PaymentProvider adapter (thin fetch, no SDK).
 *
 * Hosted checkout via the Payments API (`data.link`). Activation is a secret key
 * (`FLWSECK_TEST-…` / `FLWSECK-…`) plus a webhook "secret hash" you set in the
 * dashboard (sent back as the `verif-hash` header).
 *
 * PARSE-DON'T-TRUST: verifyWebhook only compares the hash + extracts identity;
 * retrievePayment verifies by reference for the authoritative amount/status.
 *
 * NOTE: built to Flutterwave's documented v3 API; not sandbox-verified here.
 */
import { timingSafeEqual } from 'crypto'
import { fromMinor, toMinor } from '@/payments/core/money'
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

const API = 'https://api.flutterwave.com/v3'

/** Constant-time string equality (for the verif-hash). Exported for tests. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Verify the verif-hash header + extract identity. Exported for tests. */
export function extractFlutterwaveWebhookIdentity(
  rawBody: string,
  headers: Headers,
  secretHash: string,
): VerifiedWebhook | null {
  const received = headers.get('verif-hash')
  if (!received || !safeEqual(received, secretHash)) return null
  let body: { event?: string; data?: { id?: number | string; tx_ref?: string; status?: string } }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return null
  }
  const reference = body.data?.tx_ref ?? ''
  const eventId = body.data?.id != null ? String(body.data.id) : reference
  const hint = body.data?.status === 'successful' ? 'payment' : 'other'
  return { providerEventId: eventId, reference, hint }
}

/** Map a Flutterwave transaction status to our outcome. Exported for tests. */
export function mapFlutterwaveStatus(status: string): RetrievedPayment['outcome'] {
  switch (status) {
    case 'successful':
      return 'succeeded'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'pending'
  }
}

function keyMode(secretKey: string): 'test' | 'live' | 'unknown' {
  if (/^FLWSECK_TEST-/.test(secretKey)) return 'test'
  if (/^FLWSECK-/.test(secretKey)) return 'live'
  return 'unknown'
}

const CREDENTIAL_SCHEMA: CredentialSchema = [
  {
    name: 'secretKey',
    label: 'Secret key',
    type: 'secret',
    secret: true,
    required: true,
    help: 'Your Flutterwave secret key (FLWSECK_TEST-… / FLWSECK-…). Stored encrypted.',
  },
  {
    name: 'secretHash',
    label: 'Webhook secret hash',
    type: 'secret',
    secret: true,
    required: true,
    help: 'The "Secret hash" you set under Settings → Webhooks in Flutterwave. Stored encrypted.',
  },
]

async function flwFetch(secretKey: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export const flutterwaveProvider: PaymentProvider = {
  slug: 'flutterwave',
  label: 'Flutterwave',
  region: 'Africa',
  kind: 'hosted',
  credentialSchema: CREDENTIAL_SCHEMA,
  supportedCurrencies: 'all',

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    const res = await flwFetch(input.credentials.secretKey, '/payments', {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: input.idempotencyKey,
        amount: fromMinor(input.amountMinor, input.currency),
        currency: input.currency,
        redirect_url: input.returnUrl,
        customer: { email: input.order.email ?? 'customer@example.com', name: input.order.shippingAddress?.name ?? '' },
        meta: { orderId: String(input.order.id), tenantId: String(storeIdOf(input.order)) },
      }),
    })
    if (!res.ok) throw new Error(`Flutterwave payment init failed: ${res.status}`)
    const data = (await res.json()) as { data?: { link?: string } }
    const url = data.data?.link
    if (!url) throw new Error('Flutterwave returned no payment link')
    return { providerSessionId: input.idempotencyKey, redirect: { kind: 'url', url } }
  },

  async verifyWebhook(rawBody: string, headers: Headers, creds: Credentials): Promise<VerifiedWebhook | null> {
    return extractFlutterwaveWebhookIdentity(rawBody, headers, creds.secretHash)
  },

  async retrievePayment(reference: string, creds: Credentials): Promise<RetrievedPayment> {
    const res = await flwFetch(
      creds.secretKey,
      `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    )
    if (!res.ok) throw new Error(`Flutterwave verify failed: ${res.status}`)
    const data = (await res.json()) as {
      data?: { status?: string; amount?: number; currency?: string; id?: number | string }
    }
    const d = data.data ?? {}
    const currency = (d.currency ?? '').toUpperCase()
    return {
      outcome: mapFlutterwaveStatus(d.status ?? ''),
      amountMinor: d.amount != null ? toMinor(Number(d.amount), currency) : 0,
      currency,
      providerPaymentId: d.id != null ? String(d.id) : undefined,
    }
  },

  async testConnection(creds: Credentials, environment?: 'test' | 'live'): Promise<TestConnectionResult> {
    const mode = keyMode(creds.secretKey ?? '')
    if (environment && mode !== 'unknown' && mode !== environment) {
      return {
        ok: false,
        message: `A ${mode} key is configured while ${environment === 'live' ? 'Live' : 'Test'} mode is selected. Switch the key or the mode.`,
        warnings: [],
      }
    }
    try {
      const res = await flwFetch(creds.secretKey, '/transactions?page=1')
      if (res.status === 401) return { ok: false, message: 'Invalid credentials — Flutterwave rejected the secret key.', warnings: [] }
      if (!res.ok) return { ok: false, message: 'Could not verify the Flutterwave connection.', warnings: [] }
      return { ok: true, message: 'Connected to Flutterwave successfully.', warnings: [] }
    } catch {
      return { ok: false, message: 'Unable to contact Flutterwave. Try again shortly.', warnings: [] }
    }
  },
}
