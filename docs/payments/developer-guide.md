# Payment architecture (developer guide)

Bring-your-own-gateway payments. Niblr relays, records and reconciles; it never
holds funds, is never merchant-of-record, and never touches card data.

## Module layout

```
src/payments/
  core/
    types.ts             # the PaymentProvider contract (the abstraction boundary)
    money.ts             # ISO 4217 minor-unit exponent table + conversion
    errors.ts            # PaymentError + typed codes
    provider-registry.ts # slug → adapter (the ONLY place that maps a slug)
    config-loader.ts     # load a store's config + decrypt credentials
    payment-service.ts   # the ONLY module checkout talks to
  providers/
    stripe.ts  razorpay.ts  mollie.ts  paystack.ts
    flutterwave.ts  xendit.ts  offline.ts
  security/
    credential-encryption.ts   # wraps src/lib/encryption.ts (AES-256-GCM)
  reconciliation/
    payment-event-handler.ts   # the authoritative "mark paid" path
    side-effects.ts            # stock / discount / email / invoice (exactly once)
```

Data lives in tenant-scoped Payload collections: `gateway-configs` (one row
per `(tenant, provider)`, encrypted credential blob), `payment-attempts` (our
store-scoped index + retry ledger), `processed-webhook-events` (idempotency),
and `payment-gateway-requests` (merchant requests for unsupported providers,
triaged by the platform).

The `provider` column is a plain `varchar` (a registry key), **not** a DB enum —
so adding a provider never needs a schema migration. Six hosted adapters ship
today (Stripe, Razorpay, Mollie, Paystack, Flutterwave, Xendit) plus Offline;
all except Stripe/Razorpay are thin `fetch` adapters with no SDK dependency and
are not yet sandbox-verified.

## Non-negotiable rules

1. **The webhook is authoritative, not the browser redirect.** Reaching the
   success page never marks an order paid.
2. **Parse-don't-trust.** `verifyWebhook` returns only `{ providerEventId,
   reference, hint }`. Reconciliation calls `retrievePayment(reference)` and works
   off the **server-fetched** payment — never the webhook body.
3. **Totals are recalculated server-side** (`buildOrderFromCart`). Client amounts
   are never charged.
4. **Order lookup goes through our own `payment-attempts` index**, keyed
   `(store, provider, providerSessionId)` — never provider metadata. This gives
   tenant isolation for free.
5. **Secrets are encrypted at rest, never returned, never logged.** Masked display
   only.
6. **Every payment record is store-scoped and verified on every read/write.**
7. **Nothing outside `payments/providers/<id>/` may branch on the provider id.**
   The registry is the only slug→adapter map; `slug` is a plain string.
8. **`authorized` is not `paid`.** No fulfilment on an authorized-but-uncaptured
   payment.

## Money

Canonical representation is **integer minor units + ISO 4217 currency**. The
exponent is not always 2 (JPY/KRW/VND = 0; KWD/BHD/OMR/JOD/TND = 3). Convert only
inside `core/money.ts`; never write `amount / 100` elsewhere.

## Credential storage

Credentials are a per-provider JSON object encrypted into a single blob
(`encryptedCredentialBlob` field → `src/lib/encryption.ts`, AES-256-GCM, unique
IV, versioned `enc:v1:`, fails closed). Key: `CREDENTIALS_ENCRYPTION_KEY`
(64 hex chars — `openssl rand -hex 32`). Secret fields are masked on read and a
blank incoming value preserves the stored secret.

## Webhook normalisation

`POST /api/payments/webhooks/{provider}/{storeId}` (route: `/api/webhooks/[provider]/[tenantSlug]`):
raw body → resolve store → load config + decrypt webhook secret → `verifyWebhook`
→ `reconcile()`. Reconciliation dedupes on `processed-webhook-events`, resolves the
order via `payment-attempts`, re-fetches the payment, validates currency then
amount, and marks paid exactly once (or records `authorized` without fulfilling).

## How to add a provider

1. Create `src/payments/providers/<slug>.ts` implementing `PaymentProvider`.
2. Register it in `core/provider-registry.ts` (one line).
3. That's it — Settings → Payments renders the new provider's card from its
   `credentialSchema`, and checkout offers it when enabled. **No UI or checkout
   changes.**

### Required tests for a new adapter

- `verifyWebhook`: valid signature → identity only (no amount/status); bad
  signature → `null`.
- `retrievePayment`: maps provider states to `succeeded` / **`authorized`** /
  failed / expired, with amount + currency from the provider.
- `testConnection`: detects wrong-mode keys; surfaces any manual-capture warning.
- Money mapping at the adapter boundary if the provider uses decimals/strings.

### Security requirements for an adapter

- Pure of DB/env — all secrets arrive via `credentials`.
- Never log secrets or raw provider error objects.
- `testConnection` must be read-only (never create a charge).
- Signature verification must use the **raw** request body.

## Skeleton adapter (do not register — reference only)

```ts
import type {
  PaymentProvider, CreateSessionInput, CreatedSession, Credentials,
  VerifiedWebhook, RetrievedPayment, TestConnectionResult, CredentialSchema,
} from '@/payments/core/types'

const credentialSchema: CredentialSchema = [
  { name: 'apiKey', label: 'API key', type: 'secret', secret: true, required: true },
  { name: 'webhookSecret', label: 'Webhook secret', type: 'secret', secret: true, required: true },
]

export const acmePayProvider: PaymentProvider = {
  slug: 'acmepay',
  label: 'AcmePay',
  kind: 'hosted',
  credentialSchema,
  supportedCurrencies: 'all',

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    // Call the provider with input.amountMinor / input.currency / input.idempotencyKey.
    // Return the opaque session id and how the buyer leaves our domain.
    return { providerSessionId: 'sess_123', redirect: { kind: 'url', url: 'https://acmepay/checkout/sess_123' } }
    // or, for a signed form POST provider:
    // return { providerSessionId, redirect: { kind: 'form', action, method: 'POST', fields } }
  },

  async verifyWebhook(rawBody, headers, creds: Credentials): Promise<VerifiedWebhook | null> {
    // Verify the signature over the RAW body. Return identity ONLY — no money/status.
    // return { providerEventId, reference /* == providerSessionId */, hint: 'payment' }
    return null
  },

  async retrievePayment(reference, creds): Promise<RetrievedPayment> {
    // Server-fetch the payment. This is the sole authority for money + outcome.
    return { outcome: 'succeeded', amountMinor: 0, currency: 'USD', providerPaymentId: 'pay_1' }
  },

  async testConnection(creds, environment): Promise<TestConnectionResult> {
    // Read-only credential check. Never create a charge.
    return { ok: true, message: 'Connected.', warnings: [] }
  },
}
```

Structure future adapters so they *could* become `@niblr/payment-*` packages;
don't split into packages until the repo is a monorepo where that's natural.
