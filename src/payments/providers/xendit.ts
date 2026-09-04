/**
 * Xendit PaymentProvider adapter (thin fetch, no SDK).
 *
 * Hosted checkout via the Invoices API (`invoice_url`). Activation is a secret
 * key (`xnd_development_…` / `xnd_production_…`, used as HTTP Basic username)
 * plus a callback verification token (sent back as `x-callback-token`).
 *
 * PARSE-DON'T-TRUST: verifyWebhook only compares the token + extracts identity;
 * retrievePayment fetches the invoice for the authoritative amount/status.
 *
 * NOTE: built to Xendit's documented API; not sandbox-verified in this change.
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

const API = 'https://api.xendit.co'

function basicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

/** Constant-time string equality for the callback token. Exported for tests. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Verify the x-callback-token + extract identity. Exported for tests. */
export function extractXenditWebhookIdentity(
  rawBody: string,
  headers: Headers,
  callbackToken: string,
): VerifiedWebhook | null {
  const received = headers.get('x-callback-token')
  if (!received || !safeEqual(received, callbackToken)) return null
  let body: { id?: string; status?: string; external_id?: string }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return null
  }
  const id = body.id ?? ''
  if (!id) return null
  const hint = body.status === 'PAID' || body.status === 'SETTLED' ? 'payment' : 'other'
  return { providerEventId: id, reference: id, hint }
}

/** Map a Xendit invoice status to our outcome. Exported for tests. */
export function mapXenditStatus(status: string): RetrievedPayment['outcome'] {
  switch (status) {
    case 'PAID':
    case 'SETTLED':
      return 'succeeded'
    case 'EXPIRED':
      return 'expired'
    default:
      return 'pending'
  }
}

function keyMode(secretKey: string): 'test' | 'live' | 'unknown' {
  if (/^xnd_production_/.test(secretKey)) return 'live'
  if (/^xnd_development_/.test(secretKey)) return 'test'
  return 'unknown'
}

const CREDENTIAL_SCHEMA: CredentialSchema = [
  {
    name: 'secretKey',
    label: 'Secret API key',
    type: 'secret',
    secret: true,
    required: true,
    help: 'Your Xendit secret key (xnd_development_… / xnd_production_…). Stored encrypted.',
  },
  {
    name: 'callbackToken',
    label: 'Webhook verification token',
    type: 'secret',
    secret: true,
    required: true,
    help: 'The callback verification token from Xendit dashboard → Settings → Webhooks. Stored encrypted.',
  },
]

async function xenditFetch(secretKey: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: basicAuth(secretKey), 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export const xenditProvider: PaymentProvider = {
  slug: 'xendit',
  label: 'Xendit',
  region: 'SE Asia',
  kind: 'hosted',
  credentialSchema: CREDENTIAL_SCHEMA,
  supportedCurrencies: ['IDR', 'PHP', 'USD', 'MYR', 'THB', 'VND'],

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    const res = await xenditFetch(input.credentials.secretKey, '/v2/invoices', {
      method: 'POST',
      body: JSON.stringify({
        external_id: input.idempotencyKey,
        amount: fromMinor(input.amountMinor, input.currency),
        currency: input.currency,
        payer_email: input.order.email ?? undefined,
        description: `Order ${input.order.orderNumber ?? input.order.id}`,
        success_redirect_url: input.returnUrl,
        failure_redirect_url: input.cancelUrl,
      }),
    })
    if (!res.ok) throw new Error(`Xendit invoice create failed: ${res.status}`)
    const data = (await res.json()) as { id?: string; invoice_url?: string }
    if (!data.id || !data.invoice_url) throw new Error('Xendit returned no invoice url')
    return { providerSessionId: data.id, redirect: { kind: 'url', url: data.invoice_url } }
  },

  async verifyWebhook(rawBody: string, headers: Headers, creds: Credentials): Promise<VerifiedWebhook | null> {
    return extractXenditWebhookIdentity(rawBody, headers, creds.callbackToken)
  },

  async retrievePayment(reference: string, creds: Credentials): Promise<RetrievedPayment> {
    const res = await xenditFetch(creds.secretKey, `/v2/invoices/${encodeURIComponent(reference)}`)
    if (!res.ok) throw new Error(`Xendit retrieve invoice failed: ${res.status}`)
    const inv = (await res.json()) as { status?: string; amount?: number; currency?: string }
    const currency = (inv.currency ?? '').toUpperCase()
    return {
      outcome: mapXenditStatus(inv.status ?? ''),
      amountMinor: inv.amount != null ? toMinor(Number(inv.amount), currency) : 0,
      currency,
      providerPaymentId: reference,
    }
  },

  async testConnection(creds: Credentials, environment?: 'test' | 'live'): Promise<TestConnectionResult> {
    const mode = keyMode(creds.secretKey ?? '')
    if (environment && mode !== 'unknown' && mode !== environment) {
      return {
        ok: false,
        message: `A ${mode} key is configured while ${environment === 'live' ? 'Live' : 'Test'} mode is selected. Use a ${environment === 'live' ? 'xnd_production_' : 'xnd_development_'} key or switch modes.`,
        warnings: [],
      }
    }
    try {
      const res = await xenditFetch(creds.secretKey, '/balance')
      if (res.status === 401) return { ok: false, message: 'Invalid credentials — Xendit rejected the secret key.', warnings: [] }
      if (!res.ok) return { ok: false, message: 'Could not verify the Xendit connection.', warnings: [] }
      return { ok: true, message: 'Connected to Xendit successfully.', warnings: [] }
    } catch {
      return { ok: false, message: 'Unable to contact Xendit. Try again shortly.', warnings: [] }
    }
  },
}
