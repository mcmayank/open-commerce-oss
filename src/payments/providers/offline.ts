/**
 * Offline payment method (Cash on Delivery / bank transfer).
 *
 * Modelled as a first-class provider so checkout and Settings treat it exactly
 * like a hosted connector (invariant #7 — nothing branches on the provider id).
 * It differs only in its capabilities:
 *  - empty-ish credentialSchema (no secrets),
 *  - `createSession` returns `{ kind: 'none' }` — no redirect off-site,
 *  - it has no webhook and `retrievePayment` is never called (throws if it is),
 *  - `testConnection` trivially succeeds.
 *
 * Offline orders stay `pending` until the merchant marks them paid in the order
 * dashboard. There is no automatic paid transition (by design).
 */
import { PaymentError } from '@/payments/core/errors'
import type {
  CreateSessionInput,
  CreatedSession,
  CredentialSchema,
  PaymentProvider,
  RetrievedPayment,
  TestConnectionResult,
  VerifiedWebhook,
} from '@/payments/core/types'

const CREDENTIAL_SCHEMA: CredentialSchema = [
  {
    name: 'instructions',
    label: 'Payment instructions',
    type: 'text',
    help: 'Shown to the customer at checkout, e.g. bank transfer details or "Pay cash on delivery".',
  },
]

export const offlineProvider: PaymentProvider = {
  slug: 'offline',
  label: 'Offline (Cash / Bank transfer)',
  region: 'Any market',
  kind: 'offline',
  credentialSchema: CREDENTIAL_SCHEMA,
  supportedCurrencies: 'all',

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    // No provider session; the order is created pending and the buyer goes
    // straight to the confirmation page.
    return {
      providerSessionId: `offline-${input.idempotencyKey}`,
      redirect: { kind: 'none', orderId: input.order.id },
    }
  },

  async verifyWebhook(): Promise<VerifiedWebhook | null> {
    // Offline has no webhook.
    return null
  },

  async retrievePayment(): Promise<RetrievedPayment> {
    throw new PaymentError('OFFLINE_NO_RETRIEVE', 'Offline payments are not retrievable from a provider.')
  },

  async testConnection(): Promise<TestConnectionResult> {
    return { ok: true, message: 'No credentials required for offline payments.', warnings: [] }
  },
}
