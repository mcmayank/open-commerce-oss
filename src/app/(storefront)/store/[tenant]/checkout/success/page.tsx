import { notFound } from 'next/navigation'
import React from 'react'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getStore, getStoreSettings } from '@/lib/storefront'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import { formatMoney } from '@/lib/money'
import { formatFulfilmentSummary } from '@/lib/fulfillment'
import type { Order } from '@/payload-types'
import { getProvider } from '@/payments/core/provider-registry'
import { showsNiblrBranding } from '@/lib/branding'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import StoreTheme from '../../components/StoreTheme'
import { CartClearer } from './CartClearer'
import { TrackOnMount } from '@/components/analytics/TrackOnMount'
import { toMajor } from '@/lib/analytics'
import StatusPoller from './StatusPoller'
import { storeWhere } from '@/store-scope'

export const dynamic = 'force-dynamic'

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ order?: string }>
}) {
  const { tenant } = await params
  const { order: orderId } = await searchParams

  const store = await getStore(tenant)
  if (!store) notFound()

  const settings = await getStoreSettings(store.id)
  const storeName = settings?.storeName ?? store.name
  const currency = settings?.currency ?? 'AED'

  // Look up the order — tenant-scoped to prevent info disclosure
  let order: Order | null = null
  if (orderId) {
    const numericId = Number(orderId)
    if (Number.isFinite(numericId) && numericId > 0) {
      try {
        const payload = await getPayload({ config })
        const { docs } = await payload.find({
          collection: 'orders',
          where: {
            and: [
              { id: { equals: numericId } },
              storeWhere(store.id),
            ],
          },
          limit: 1,
          overrideAccess: true,
        })
        order = (docs[0] as Order) ?? null
      } catch {
        // Invalid or missing order — render the generic thank-you state
      }
    }
  }

  const { theme } = await resolveActiveTheme(store)
  const layout = resolveThemeLayout(theme?.layout)

  return (
    <div className="flex min-h-screen flex-col">
      {/* Clear cart cookie client-side — server components cannot set cookies */}
      <CartClearer />
      {order ? (
        <TrackOnMount
          event="purchase"
          dedupeKey={`purchase-${order.id}`}
          params={{
            transaction_id: order.orderNumber ?? String(order.id),
            currency,
            value: toMajor(order.total),
            items: order.lineItems.map((line) => ({
              item_id: line.productId,
              item_name: `${line.title}${line.variantTitle ? ` — ${line.variantTitle}` : ''}`,
              price: toMajor(line.unitPrice),
              quantity: line.qty,
            })),
          }}
        />
      ) : null}
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <Header storeName={storeName} settings={settings} layout={layout.header} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        {order ? (
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-8 text-center shadow-sm">
            {/* Success icon */}
            <div className="mb-6 flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'var(--color-primary)' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-(--color-primary-contrast)"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h1 className="mb-2 text-3xl font-bold text-(--color-heading)">Thank you!</h1>
            <p className="mb-1 text-lg text-(--color-text-muted)">Your order has been received.</p>
            <p
              className="mb-6 text-sm font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              {order.orderNumber ?? `Order #${order.id}`}
            </p>

            {/* Payment status banner — polls the webhook-driven order status.
                The provider's redirect back here is never treated as proof of
                payment; only the webhook flips this to confirmed. */}
            <StatusPoller
              tenantSlug={tenant}
              orderId={order.id}
              initialStatus={order.status ?? 'pending'}
              mode={getProvider(order.paymentProvider ?? '')?.kind === 'offline' ? 'offline' : 'online'}
            />

            {/* Scheduled pickup/delivery */}
            {(() => {
              const summary = formatFulfilmentSummary(order.fulfillment ?? {})
              if (!summary) return null
              return (
                <div className="mb-6 rounded-lg border border-(--color-border) bg-(--color-surface-alt) px-4 py-3 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
                    {order.fulfillment?.method === 'pickup' ? 'Collection' : 'Delivery'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-(--color-heading)">{summary}</p>
                </div>
              )
            })()}

            {/* Order line items */}
            <div className="mb-6 text-left">
              <h2 className="mb-3 text-base font-semibold text-(--color-heading)">Order Summary</h2>
              <div className="divide-y divide-(--color-border) rounded-lg border border-(--color-border)">
                {order.lineItems.map((line, idx) => (
                  <div
                    key={line.id ?? idx}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 truncate pr-4 text-(--color-text)">
                      {line.title}
                      {line.variantTitle ? (
                        <span className="text-(--color-text-muted)"> &mdash; {line.variantTitle}</span>
                      ) : null}
                      <span className="text-(--color-text-muted)"> &times; {line.qty}</span>
                    </span>
                    <span className="shrink-0 font-medium text-(--color-heading)">
                      {formatMoney(line.lineTotal, currency)}
                    </span>
                  </div>
                ))}
                {order.giftCardAmount != null && order.giftCardAmount > 0 ? (
                  <>
                    <div className="flex items-center justify-between px-4 py-3 text-base font-bold text-(--color-heading)">
                      <span>Total</span>
                      <span>{formatMoney(order.total, currency)}</span>
                    </div>
                    {/* Gift card applied as TENDER, not a discount: `order.total`
                        above is the full invoice amount and never moves — only
                        what the gateway was asked for shrinks. Never labelled
                        "Discount" so the summary agrees with the invoice. */}
                    <div className="flex items-center justify-between px-4 py-3 text-sm text-(--color-text-muted)">
                      <span>Paid by gift card</span>
                      <span>&minus;{formatMoney(order.giftCardAmount, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 text-base font-bold text-(--color-heading)">
                      <span>Amount due</span>
                      <span>{formatMoney(order.total - order.giftCardAmount, currency)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 text-base font-bold text-(--color-heading)">
                    <span>Total</span>
                    <span>{formatMoney(order.total, currency)}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="mb-6 text-sm text-(--color-text-muted)">
              A confirmation email has been sent to{' '}
              <strong className="text-(--color-text)">{order.email}</strong>.
            </p>

            <a
              href="/"
              className="inline-block rounded-lg px-8 py-3 text-sm font-semibold text-(--color-primary-contrast) transition-opacity hover:opacity-90"
              style={{
                background: 'var(--color-primary)',
                borderRadius: 'var(--radius-button)',
              }}
            >
              Continue Shopping
            </a>
          </div>
        ) : (
          /* Generic state — no orderId or order not found */
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-8 text-center shadow-sm">
            <div className="mb-6 flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'var(--color-primary)' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-(--color-primary-contrast)"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h1 className="mb-2 text-2xl font-bold text-(--color-heading)">Order received!</h1>
            <p className="mb-6 text-(--color-text-muted)">
              Thank you for shopping with us. Your order is being processed.
            </p>
            <a
              href="/"
              className="inline-block rounded-lg px-8 py-3 text-sm font-semibold text-(--color-primary-contrast) transition-opacity hover:opacity-90"
              style={{
                background: 'var(--color-primary)',
                borderRadius: 'var(--radius-button)',
              }}
            >
              Continue Shopping
            </a>
          </div>
        )}
      </main>

      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
