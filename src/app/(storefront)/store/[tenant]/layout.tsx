import React from 'react'
import { getStore, getStoreSettings, getTenantStatusBySlug } from '@/lib/storefront'
import { readAnalytics } from '@/lib/analytics'
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts'
import { getCartSummary } from '@/lib/cart-summary'
import { CartProvider } from './components/cart/CartProvider'
import { CartDrawer } from './components/cart/CartDrawer'
import { StoreUnavailable } from './components/StoreUnavailable'
import { StorefrontVoice } from '@/storefront-overlay'

/**
 * Wraps every storefront route for a tenant. Sole per-tenant analytics
 * injection point: it has the tenant slug, and storefronts render under the
 * (storefront) route group's own <html>, so a tenant tag can never leak onto
 * niblr.store. Settings are cached (getStoreSettings), so this adds no real
 * cost over the pages that already load them.
 *
 * Also the sole mount point for the cart: seeds CartProvider with the
 * httpOnly-cookie-derived summary (server-only read) and renders the
 * CartDrawer once per tenant so any page's header/CTA can open it via
 * useCart().openDrawer.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const store = await getStore(tenant)

  // `getStore` returns null for any non-active tenant. Distinguish a suspended
  // store (show a temporary holding page across all its routes) from a genuinely
  // unknown slug (fall through to the normal not-found handling in the pages).
  if (!store) {
    const status = await getTenantStatusBySlug(tenant)
    if (status === 'suspended') return <StoreUnavailable />
  }

  const settings = store ? await getStoreSettings(store.id) : null
  const analytics = readAnalytics(settings?.analytics)
  const currency = settings?.currency ?? 'AED'
  const initialCart = store
    ? await getCartSummary(store, currency)
    : { lines: [], count: 0, total: 0, currency, tax: null }

  return (
    <>
      <AnalyticsScripts {...analytics} />
      <CartProvider initial={initialCart}>
        {children}
        <CartDrawer />
      </CartProvider>
      {/* Sole mount point for hosted-only storefront extras (the voice assistant). */}
      {store ? <StorefrontVoice store={store} /> : null}
    </>
  )
}
