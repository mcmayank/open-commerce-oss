import { notFound } from 'next/navigation'
import React from 'react'
import { getStore, getStoreSettings } from '@/lib/storefront'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import { getCartSummary } from '@/lib/cart-summary'
import { formatMoney } from '@/lib/money'
import { showsNiblrBranding } from '@/lib/branding'
import Header from '../components/Header'
import Footer from '../components/Footer'
import StoreTheme from '../components/StoreTheme'
import { setQty, removeFromCart } from './actions'

export default async function CartPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params

  const store = await getStore(tenant)
  if (!store) notFound()

  const settings = await getStoreSettings(store.id)
  const storeName = settings?.storeName ?? store.name
  const currency = settings?.currency ?? 'AED'

  const { theme } = await resolveActiveTheme(store)

  const summary = await getCartSummary(store, currency)
  const lines = summary.lines
  const cartTotal = summary.total
  const isEmpty = lines.length === 0
  const layout = resolveThemeLayout(theme?.layout)

  return (
    <div className="flex min-h-screen flex-col">
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <Header storeName={storeName} settings={settings} layout={layout.header} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <h1
          className="mb-8 text-3xl font-bold tracking-tight text-(--color-heading)"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Your Cart
        </h1>

        {isEmpty ? (
          /* Empty-cart state */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-alt) py-24 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mb-4 h-16 w-16 text-(--color-border)"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-lg font-medium text-(--color-text-muted)">Your cart is empty</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">Add some products to get started.</p>
            <a
              href="/products"
              className="mt-6 inline-block px-6 py-3 text-sm font-semibold text-(--color-primary-contrast) transition-opacity hover:opacity-90"
              style={{
                background: 'var(--color-primary)',
                borderRadius: 'var(--radius-button)',
              }}
            >
              Browse Products
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            {/* Line items */}
            <div className="flex-1 divide-y divide-(--color-border) rounded-xl border border-(--color-border) bg-(--color-surface)">
              {lines.map((line) => (
                <div
                  key={`${line.productId}-${line.variantId ?? ''}`}
                  className="flex items-start gap-4 p-4 sm:p-6"
                >
                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/products/${line.slug}`}
                      className="font-semibold text-(--color-heading) hover:underline"
                    >
                      {line.title}
                    </a>
                    {line.variantTitle && (
                      <p className="mt-0.5 text-sm text-(--color-text-muted)">{line.variantTitle}</p>
                    )}
                    <p className="mt-1 text-sm text-(--color-text-muted)">
                      {formatMoney(line.unitPrice, currency)} each
                    </p>
                  </div>

                  {/* Qty update form */}
                  <form action={setQty} className="flex items-center gap-2">
                    <input type="hidden" name="productId" value={line.productId} />
                    {line.variantId && (
                      <input type="hidden" name="variantId" value={line.variantId} />
                    )}
                    <label htmlFor={`qty-${line.productId}-${line.variantId ?? ''}`} className="sr-only">
                      Quantity
                    </label>
                    <input
                      id={`qty-${line.productId}-${line.variantId ?? ''}`}
                      name="qty"
                      type="number"
                      min={1}
                      defaultValue={line.qty}
                      className="w-16 rounded-lg border border-(--color-border) px-2 py-1.5 text-center text-sm focus:border-(--color-primary) focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-(--color-surface-alt) px-3 py-1.5 text-xs font-medium text-(--color-text) hover:opacity-80 transition-colors"
                    >
                      Update
                    </button>
                  </form>

                  {/* Line total */}
                  <div className="w-24 text-right">
                    <p className="font-semibold text-(--color-heading)">
                      {formatMoney(line.lineTotal, currency)}
                    </p>
                  </div>

                  {/* Remove form */}
                  <form action={removeFromCart}>
                    <input type="hidden" name="productId" value={line.productId} />
                    {line.variantId && (
                      <input type="hidden" name="variantId" value={line.variantId} />
                    )}
                    <button
                      type="submit"
                      aria-label={`Remove ${line.title}${line.variantTitle ? ` (${line.variantTitle})` : ''} from cart`}
                      className="rounded-md p-1.5 text-(--color-text-muted) hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </form>
                </div>
              ))}
            </div>

            {/* Order summary */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-6">
                <h2 className="mb-4 text-lg font-semibold text-(--color-heading)">Order Summary</h2>

                <div className="space-y-2 text-sm">
                  {lines.map((line) => (
                    <div
                      key={`summary-${line.productId}-${line.variantId ?? ''}`}
                      className="flex justify-between text-(--color-text-muted)"
                    >
                      <span className="truncate mr-2">
                        {line.title}
                        {line.variantTitle ? ` — ${line.variantTitle}` : ''} × {line.qty}
                      </span>
                      <span className="shrink-0">{formatMoney(line.lineTotal, currency)}</span>
                    </div>
                  ))}
                </div>

                {/* VAT before payment, not just on the receipt. Inclusive is
                    informational — the total below is unchanged. */}
                {summary.tax && !summary.tax.inclusive ? (
                  <div className="mt-4 flex justify-between text-sm text-(--color-text-muted)">
                    <span>{summary.tax.label}</span>
                    <span>{formatMoney(summary.tax.amountMinor, currency)}</span>
                  </div>
                ) : null}

                <div className="mt-4 border-t border-(--color-border) pt-4 flex justify-between text-base font-bold text-(--color-heading)">
                  <span>Total</span>
                  <span>{formatMoney(cartTotal, currency)}</span>
                </div>

                {summary.tax && summary.tax.inclusive ? (
                  <p className="mt-1 text-right text-xs text-(--color-text-muted)">
                    {summary.tax.label}: {formatMoney(summary.tax.amountMinor, currency)}
                  </p>
                ) : null}

                {/* Checkout */}
                <a
                  href="/checkout"
                  className="mt-6 block w-full rounded-lg px-6 py-3 text-center text-sm font-semibold text-(--color-primary-contrast) transition-opacity hover:opacity-90"
                  style={{
                    background: 'var(--color-primary)',
                    borderRadius: 'var(--radius-button)',
                  }}
                >
                  Proceed to Checkout
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
