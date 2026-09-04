/**
 * Mollie PaymentProvider adapter (thin fetch, no SDK).
 *
 * Hosted checkout via the Payments API (`_links.checkout`). Activation is a
 * single API key (`test_…` / `live_…`); the key prefix determines the mode.
 *
 * PARSE-DON'T-TRUST is native here: Mollie's webhook body is just
 * `id=tr_xxx` (form-encoded, UNSIGNED). Security comes entirely from re-fetching
 * the payment with our API key — a forged or foreign id simply won't resolve to
 * one of our payments, and our payment-attempts index is store-scoped.
 *
 * Mollie also needs the webhook URL at payment-creation time (not dashboard-
 * configured), so `createSession` uses `input.webhookUrl`.
 *
 * NOTE: built to Mollie's documented v2 API; not sandbox-verified in this change.
 */
import { currencyExponent, fromMinor, toMinor } from '@/payments/core/money'
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

const API = 'https://api.mollie.com/v2'

/** Mollie wants a decimal string with the currency's exponent, e.g. "10.00". */
export function mollieAmountValue(amountMinor: number, currency: string): string {
  return fromMinor(amountMinor, currency).toFixed(currencyExponent(currency))
}

/** Extract the payment id from Mollie's form-encoded webhook body. Exported for tests. */
export function extractMollieWebhookId(rawBody: string): string | null {
  const id = new URLSearchParams(rawBody).get('id')
  return id && id.startsWith('tr_') ? id : null
}

/** Map a Mollie payment status to our outcome. Exported for tests. */
export function mapMollieStatus(status: string): RetrievedPayment['outcome'] {
  switch (status) {
    case 'paid':
      return 'succeeded'
    case 'authorized':
      return 'authorized'
    case 'open':
    case 'pending':
      return 'pending'
    case 'expired':
      return 'expired'
    case 'canceled':
      return 'cancelled'
    case 'failed':
      return 'failed'
    default:
      return 'pending'
  }
}

function keyMode(apiKey: string): 'test' | 'live' | 'unknown' {
  if (apiKey.startsWith('live_')) return 'live'
  if (apiKey.startsWith('test_')) return 'test'
  return 'unknown'
}

const CREDENTIAL_SCHEMA: CredentialSchema = [
  {
    name: 'apiKey',
    label: 'API key',
    type: 'secret',
    secret: true,
    required: true,
    help: 'Your Mollie API key (test_… or live_…). The prefix sets the mode. Stored encrypted.',
  },
]

async function mollieFetch(apiKey: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export const mollieProvider: PaymentProvider = {
  slug: 'mollie',
  label: 'Mollie',
  region: 'Europe',
  kind: 'hosted',
  credentialSchema: CREDENTIAL_SCHEMA,
  supportedCurrencies: 'all',

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    const res = await mollieFetch(input.credentials.apiKey, '/payments', {
      method: 'POST',
      body: JSON.stringify({
        amount: { currency: input.currency, value: mollieAmountValue(input.amountMinor, input.currency) },
        description: `Order ${input.order.orderNumber ?? input.order.id}`,
        redirectUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
        webhookUrl: input.webhookUrl,
        metadata: { orderId: String(input.order.id), tenantId: String(storeIdOf(input.order)), idempotencyKey: input.idempotencyKey },
      }),
    })
    if (!res.ok) throw new Error(`Mollie createSession failed: ${res.status}`)
    const data = (await res.json()) as { id: string; _links?: { checkout?: { href?: string } } }
    const url = data._links?.checkout?.href
    if (!url) throw new Error('Mollie payment has no checkout link')
    return { providerSessionId: data.id, redirect: { kind: 'url', url } }
  },

  async verifyWebhook(rawBody: string): Promise<VerifiedWebhook | null> {
    // No signature — the id is the only content; authority comes from retrievePayment.
    const id = extractMollieWebhookId(rawBody)
    if (!id) return null
    return { providerEventId: id, reference: id, hint: 'payment' }
  },

  async retrievePayment(reference: string, creds: Credentials): Promise<RetrievedPayment> {
    const res = await mollieFetch(creds.apiKey, `/payments/${reference}`)
    if (!res.ok) throw new Error(`Mollie retrievePayment failed: ${res.status}`)
    const p = (await res.json()) as { status: string; amount?: { value?: string; currency?: string } }
    const currency = (p.amount?.currency ?? '').toUpperCase()
    return {
      outcome: mapMollieStatus(p.status),
      amountMinor: p.amount?.value ? toMinor(parseFloat(p.amount.value), currency) : 0,
      currency,
      providerPaymentId: reference,
    }
  },

  async testConnection(creds: Credentials, environment?: 'test' | 'live'): Promise<TestConnectionResult> {
    const mode = keyMode(creds.apiKey ?? '')
    if (environment && mode !== 'unknown' && mode !== environment) {
      return {
        ok: false,
        message: `A ${mode} key is configured while ${environment === 'live' ? 'Live' : 'Test'} mode is selected. Use a ${environment}_… key or switch modes.`,
        warnings: [],
      }
    }
    try {
      const res = await mollieFetch(creds.apiKey, '/payments?limit=1')
      if (res.status === 401) return { ok: false, message: 'Invalid credentials — Mollie rejected the API key.', warnings: [] }
      if (!res.ok) return { ok: false, message: 'Could not verify the Mollie connection.', warnings: [] }
      return { ok: true, message: 'Connected to Mollie successfully.', warnings: [] }
    } catch {
      return { ok: false, message: 'Unable to contact Mollie. Try again shortly.', warnings: [] }
    }
  },
}
