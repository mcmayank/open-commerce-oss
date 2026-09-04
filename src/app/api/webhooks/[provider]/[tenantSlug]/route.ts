/**
 * Payment webhook endpoint — the SOURCE OF TRUTH for payment success.
 *
 * Route: POST /api/webhooks/[provider]/[tenantSlug]
 *
 * Flow (see payments/reconciliation/payment-event-handler for the details):
 *   raw body → resolve store → load store config + decrypt webhook secret →
 *   verifyWebhook (identity only) → reconcile (dedupe → resolve order via our
 *   store-scoped payment_attempts index → RE-FETCH the payment → validate
 *   currency+amount → mark paid exactly once / never fulfil on authorized).
 *
 * Invariants:
 *  - The raw body is read BEFORE any parsing (signature must see exact bytes).
 *  - `verifyWebhook` returning null (invalid/tampered) → 400, mutate nothing.
 *  - Only the webhook (never the browser redirect) marks an order paid.
 *  - Reconciliation re-fetches the payment; the webhook payload is never trusted
 *    for money or status.
 *
 * Webhooks bypass the tenant-rewriting proxy (its matcher excludes /api/**).
 */
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getStore } from '@/lib/storefront'
import { getStorePaymentConfig } from '@/payments/core/config-loader'
import { reconcile } from '@/payments/reconciliation/payment-event-handler'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; tenantSlug: string }> },
) {
  // 1. Raw body FIRST — signature verification needs the exact bytes.
  const rawBody = await req.text()
  const { provider, tenantSlug } = await params

  // 2. Resolve tenant from the route slug.
  const tenant = await getStore(tenantSlug)
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // 3. Load the store's config for this provider (+ decrypted credentials).
  const loaded = await getStorePaymentConfig(tenant.id, provider, payload)
  if (!loaded) {
    return NextResponse.json({ error: 'No payment configuration for this provider' }, { status: 400 })
  }

  // 4. Verify signature → identity only. null = invalid/tampered → 400, no mutation.
  const verified = await loaded.provider.verifyWebhook(rawBody, req.headers, loaded.credentials)
  if (!verified) {
    console.warn('[webhook] verification failed', { provider, store: tenant.id })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 5. Reconcile (re-fetches the payment; the authoritative "mark paid" path).
  try {
    const res = await reconcile({ payload, tenant: { id: tenant.id }, loaded, verified })
    return NextResponse.json({ received: true, status: res.status }, { status: res.httpStatus })
  } catch (err) {
    // Genuine failure → 500 so the provider retries (the dedupe record was rolled
    // back inside reconcile so the retry reprocesses).
    console.error('[webhook] reconcile failed', {
      provider,
      store: tenant.id,
      event: verified.providerEventId,
    }, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
