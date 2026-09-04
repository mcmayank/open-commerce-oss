/**
 * Public unsubscribe page — no login required.
 *
 * URL: /unsubscribe?token=<signed-token>
 *      (served at /store/[tenant]/unsubscribe in the app-router;
 *       rewritten from the subdomain root by the middleware proxy)
 *
 * Security:
 *  - The signed token IS the authorization — no session or cookie is checked.
 *  - The token's tenantId is verified against the store resolved from the URL
 *    slug before any mutation is performed.
 *  - Mutations ONLY happen via POST (see /api/marketing/unsubscribe/route.ts).
 *    GET shows a confirm form — preventing link prefetchers / scanner bots from
 *    silently unsubscribing users.
 *
 * Next 16: `params` and `searchParams` are Promises — must be awaited.
 */

import React from 'react'
import { notFound } from 'next/navigation'
import { getStore, getStoreSettings } from '@/lib/storefront'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import { verifyUnsubscribe } from '@/lib/marketing/unsubscribe-token'
import { showsNiblrBranding } from '@/lib/branding'
import Header from '../components/Header'
import Footer from '../components/Footer'
import StoreTheme from '../components/StoreTheme'

// ── Page props ───────────────────────────────────────────────────────────────

interface UnsubscribePageProps {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ token?: string; done?: string }>
}

// ── Component ────────────────────────────────────────────────────────────────

export default async function UnsubscribePage({ params, searchParams }: UnsubscribePageProps) {
  const { tenant: tenantSlug } = await params
  const { token, done } = await searchParams

  // ── 1. Resolve store from URL slug ────────────────────────────────────────
  const store = await getStore(tenantSlug)
  if (!store) notFound()

  const settings = await getStoreSettings(store.id)
  const storeName = settings?.storeName ?? store.name

  // The storefront's theme preset — without it this page would render the
  // built-in token defaults while every other storefront route renders the
  // merchant's theme. Branding fields inherit from the preset now, so it is
  // no longer cosmetic. Mirrors the cart/product/checkout routes.
  const { theme } = await resolveActiveTheme(store)
  const layout = resolveThemeLayout(theme?.layout)

  // ── 2. Verify the signed token ────────────────────────────────────────────
  const verified = token ? verifyUnsubscribe(token) : null

  // ── 3. Confirm token's tenantId matches this store ────────────────────────
  const tenantMatches = verified !== null && String(verified.tenantId) === String(store.id)

  // ── 4. Render ─────────────────────────────────────────────────────────────

  // POST handler redirects back here with ?done=1 after successful unsubscribe.
  const isSuccess = done === '1' && tenantMatches

  return (
    <div className="flex min-h-screen flex-col">
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <Header storeName={storeName} settings={settings} layout={layout.header} />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-20 sm:px-6">
        {isSuccess ? (
          /* ── Success: redirected here after POST unsubscribed the contact ── */
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            {/* Check icon */}
            <div
              className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--color-primary)' }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">{"You've been unsubscribed"}</h1>
            <p className="text-sm text-gray-500">
              {`You have been successfully removed from ${storeName}'s mailing list. You will no longer receive marketing emails.`}
            </p>
          </div>
        ) : tenantMatches ? (
          /* ── Confirm form: verify → no mutation on GET ── */
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            {/* Mail icon */}
            <div
              className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--color-primary)' }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">Unsubscribe from {storeName}?</h1>
            <p className="mb-8 text-sm text-gray-500">
              You will no longer receive marketing emails from {storeName}.
            </p>
            {/* POST to the API route — no mutation on GET */}
            <form method="post" action={`/api/marketing/unsubscribe?token=${encodeURIComponent(token ?? '')}`}>
              <button
                type="submit"
                className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--color-primary)' }}
              >
                Confirm unsubscribe
              </button>
            </form>
          </div>
        ) : (
          /* ── Invalid / expired / mismatched token ── */
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            {/* X icon */}
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">Invalid unsubscribe link</h1>
            <p className="text-sm text-gray-500">
              This unsubscribe link is invalid or expired. If you believe this is an error, please
              contact{' '}
              <span style={{ color: 'var(--color-primary)' }}>{storeName}</span> directly.
            </p>
          </div>
        )}
      </main>

      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
