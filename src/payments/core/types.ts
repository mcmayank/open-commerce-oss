/**
 * The payment provider contract.
 *
 * This is the abstraction boundary. NOTHING outside `payments/providers/<id>/`
 * may branch on a provider id — every provider-specific behaviour is expressed
 * through this interface, and the registry is the only place that maps a slug
 * to an adapter.
 *
 * Two ideas in here are load-bearing and non-obvious:
 *
 *  1. PARSE-DON'T-TRUST. `verifyWebhook` returns ONLY the identity of an event
 *     ({ providerEventId, reference, hint }) — never an amount, status or order.
 *     Reconciliation then calls `retrievePayment(reference)` and works off the
 *     server-fetched payment. This makes forged-payload reconciliation
 *     structurally impossible and lets gateways with weak/empty webhook bodies
 *     (Mollie, PayTabs) drop in without a special case.
 *
 *  2. `credentialSchema` lives on the adapter. Settings → Payments renders
 *     itself from it, so adding a provider is one folder + one registry entry
 *     with ZERO UI changes.
 */

import type { Order } from '@/payload-types'

// ── Credential schema (drives the Settings → Payments UI) ────────────────────

export type CredentialFieldType = 'text' | 'secret' | 'select'

export interface CredentialFieldSpec {
  /** Machine name, e.g. 'secretKey', 'keyId', 'webhookSecret'. */
  name: string
  /** Human label rendered in the admin UI. */
  label: string
  type: CredentialFieldType
  /**
   * When true the value is stored encrypted and only ever shown masked.
   * The Settings UI must send a blank value to mean "keep the existing secret".
   */
  secret?: boolean
  required?: boolean
  /** Short helper text shown under the field. */
  help?: string
  /** For `type: 'select'`. */
  options?: { label: string; value: string }[]
}

/** A provider's full credential spec. Empty array = no credentials (offline). */
export type CredentialSchema = CredentialFieldSpec[]

/** Decrypted, provider-specific credential values keyed by field name. */
export type Credentials = Record<string, string>

// ── Redirect (not every gateway returns a URL) ───────────────────────────────

/**
 * How the buyer leaves our domain for the provider's hosted page.
 *  - `url`  : redirect the browser to a hosted checkout URL (Stripe, Razorpay).
 *  - `form` : auto-submit a signed HTML form POST (Amazon PS, HyperPay, CCAvenue).
 *  - `none` : no redirect — used by offline methods; go straight to success.
 */
export type PaymentRedirect =
  | { kind: 'url'; url: string }
  | { kind: 'form'; action: string; method: 'POST'; fields: Record<string, string> }
  | { kind: 'none'; orderId: string | number }

// ── createSession ────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  order: Order
  /** Amount to charge, in integer minor units (already server-recalculated). */
  amountMinor: number
  currency: string
  /** OUR idempotency key — echoed to the provider where the API supports it. */
  idempotencyKey: string
  /** App-generated, origin-allowlisted. Never accepted from the client. */
  returnUrl: string
  cancelUrl: string
  /**
   * This store+provider's webhook endpoint, app-generated. Most providers have
   * the webhook configured in their dashboard and ignore this; some (e.g. Mollie)
   * require it per-payment at creation time.
   */
  webhookUrl: string
  credentials: Credentials
}

export interface CreatedSession {
  /** Opaque provider session id (cs_… / plink_…). Stored on payment_attempts. */
  providerSessionId: string
  redirect: PaymentRedirect
}

// ── verifyWebhook / retrievePayment ──────────────────────────────────────────

/** Identity of a verified webhook event. NO money, NO status, NO order. */
export interface VerifiedWebhook {
  providerEventId: string
  /** Maps to payment_attempts.providerSessionId via our own store-scoped index. */
  reference: string
  /** Optional corroboration only — never authoritative. */
  hint?: 'payment' | 'authorized' | 'other'
}

/**
 * `authorized` is NOT `succeeded`. An authorized-but-uncaptured payment (the
 * Razorpay / PayPal auto-refund trap) must never trigger fulfilment.
 */
export type PaymentOutcome =
  | 'succeeded'
  | 'authorized'
  | 'failed'
  | 'pending'
  | 'cancelled'
  | 'expired'

/** The server-fetched payment — the ONLY source of truth for money/outcome. */
export interface RetrievedPayment {
  outcome: PaymentOutcome
  amountMinor: number
  currency: string
  providerPaymentId?: string
  failureCode?: string
  failureMessage?: string
}

// ── testConnection ───────────────────────────────────────────────────────────

export interface TestConnectionResult {
  ok: boolean
  message: string
  /**
   * Non-fatal warnings surfaced to the merchant. The Razorpay
   * "manual capture enabled" case lives here: keys validate perfectly but
   * payments silently reverse unless auto-capture is on.
   */
  warnings: string[]
}

// ── The adapter interface ────────────────────────────────────────────────────

export interface PaymentProvider {
  /** Registry key. Intentionally `string` — nothing branches on it (invariant #7). */
  slug: string
  /** Display name for the Settings UI. */
  label: string
  /**
   * The market this rail primarily serves, e.g. 'Global', 'India', 'Europe'.
   * Declarative display metadata — the marketing site derives its gateway list
   * from the registry rather than keeping its own copy, so this lives here
   * beside `label`. Nothing branches on it (invariant #7 still holds).
   */
  region: string
  /** `hosted` = redirects off-site; `offline` = no redirect, no webhook. */
  kind: 'hosted' | 'offline'
  /** The Settings UI renders itself from this. Empty for offline. */
  credentialSchema: CredentialSchema
  /** ISO 4217 codes this provider supports, or 'all'. */
  supportedCurrencies?: string[] | 'all'

  createSession(input: CreateSessionInput): Promise<CreatedSession>

  /** Verify signature and return event identity only. `null` = invalid/tampered. */
  verifyWebhook(
    rawBody: string,
    headers: Headers,
    creds: Credentials,
  ): Promise<VerifiedWebhook | null>

  /** Server-fetch the payment referenced by a session id. */
  retrievePayment(reference: string, creds: Credentials): Promise<RetrievedPayment>

  /**
   * Read-only credential check. Never creates a charge. `environment` is the
   * merchant's selected mode so the adapter can flag a test key configured in
   * live mode (and the inverse).
   */
  testConnection(creds: Credentials, environment?: 'test' | 'live'): Promise<TestConnectionResult>

  /** Refund observation/initiation is optional; initiation is out of scope now. */
  refund?(providerPaymentId: string, amountMinor: number, creds: Credentials): Promise<void>

  /**
   * Backward-compatibility shim: map a v1 gateway-config's legacy discrete
   * columns (publishableKey/secretKey/webhookSecret, already decrypted) into
   * this provider's credential shape. Used only until stores are migrated to
   * the encrypted credential blob; can be removed in the cleanup release.
   */
  mapLegacyColumns?(legacy: Record<string, string | undefined | null>): Credentials
}
