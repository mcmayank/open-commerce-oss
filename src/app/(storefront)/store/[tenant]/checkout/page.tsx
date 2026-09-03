import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import React from 'react'
import { getStore, getStoreSettings, getProductsByIds } from '@/lib/storefront'
import { parseCart } from '@/lib/cart'
import { formatMoney } from '@/lib/money'
import { listFulfilmentDates } from '@/lib/fulfillment'
import { getCurrentCustomer } from '@/lib/auth/session'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import type { FulfillmentUIConfig } from './FulfillmentPicker'
import type { Product } from '@/payload-types'
import { showsNiblrBranding } from '@/lib/branding'
import Header from '../components/Header'
import Footer from '../components/Footer'
import StoreTheme from '../components/StoreTheme'
import CheckoutForm from './CheckoutForm'
import { startCheckout } from './actions'
import { TrackOnMount } from '@/components/analytics/TrackOnMount'
import { toMajor, type GaItem } from '@/lib/analytics'

export default async function CheckoutPage({
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

  // Parse cart cookie — ids + qty only, no prices
  const cookieStore = await cookies()
  const raw = cookieStore.get('cart')?.value
  const cart = parseCart(raw)

  // Empty cart → redirect to cart page
  if (cart.length === 0) {
    redirect('/cart')
  }

  // Re-derive cart summary server-side (current prices, tenant-scoped, active-only)
  const productIds = [...new Set(cart.map((l) => l.productId))]
  const products = await getProductsByIds(store.id, productIds)
  const productMap = new Map<string, Product>(products.map((p) => [String(p.id), p]))

  const summaryLines: Array<{
    key: string
    label: string
    amount: string
    amountMinor: number
    /** Carried, not recomputed — the summary's taxable base needs it. */
    isGiftCard: boolean
  }> = []
  const gaItems: GaItem[] = []
  let subtotalMinor = 0
  // Recipient fields render once per order, not per line — the design spec
  // has quantity-N gift-card purchases minting N cards that all carry the
  // single set of recipient details captured here at checkout, not on the
  // product page (see docs/superpowers/specs/2026-08-10-gift-cards-design.md).
  let hasGiftCardItem = false

  for (const line of cart) {
    const product = productMap.get(line.productId)
    if (!product) continue // product removed/inactive — skip
    const isGiftCard = product.issuesGiftCard === true
    if (isGiftCard) hasGiftCardItem = true

    let unitPrice: number
    let variantTitle: string | undefined

    if (line.variantId) {
      const variant = (product.variants ?? []).find((v) => v.id === line.variantId)
      if (!variant) continue
      unitPrice = variant.price
      variantTitle = variant.title ?? undefined
    } else {
      unitPrice = product.price
    }

    const lineTotal = unitPrice * line.qty
    subtotalMinor += lineTotal

    gaItems.push({
      item_id: `${line.productId}${line.variantId ? `-${line.variantId}` : ''}`,
      item_name: `${product.title}${variantTitle ? ` — ${variantTitle}` : ''}`,
      price: toMajor(unitPrice),
      quantity: line.qty,
    })

    const label = `${product.title}${variantTitle ? ` — ${variantTitle}` : ''} × ${line.qty}`
    summaryLines.push({
      key: `${line.productId}-${line.variantId ?? ''}`,
      label,
      amount: formatMoney(lineTotal, currency),
      amountMinor: lineTotal,
      isGiftCard,
    })
  }

  // If all products became inactive/removed after parsing
  if (summaryLines.length === 0) {
    redirect('/cart')
  }

  const subtotalFormatted = formatMoney(subtotalMinor, currency)
  // Fallback only. The live Total is computed in `CheckoutForm` from the
  // subtotal, the selected delivery fee and the tax, so what the shopper agrees
  // to is what `startCheckout` charges. Only the discount is still applied at
  // action time, because a code is unvalidated until submit.
  const totalFormatted = subtotalFormatted

  // Same shape `startCheckout` builds and hands to `buildOrderFromCart` — the
  // summary must be fed from the same settings the order is priced from.
  const taxConfig = settings?.tax
    ? {
        enabled: settings.tax.enabled === true,
        rate: typeof settings.tax.rate === 'number' ? settings.tax.rate : 0,
        pricesIncludeTax: settings.tax.pricesIncludeTax !== false,
        registrationNumber: settings.tax.registrationNumber ?? null,
      }
    : null

  // Resolve the logged-in customer (if any) to prefill checkout fields.
  // Security: we read from the session, never from form/query data.
  const customer = await getCurrentCustomer()
  const firstAddress = customer?.addresses?.[0]

  // Pickup/delivery scheduling — build the picker config when enabled.
  // (Client display only; the server action re-validates authoritatively.)
  let fulfillment: FulfillmentUIConfig | undefined
  const fc = settings?.fulfillment
  if (fc?.enabled) {
    const pickupEnabled = fc.pickup?.enabled !== false
    const deliveryEnabled = fc.delivery?.enabled === true
    if (pickupEnabled || deliveryEnabled) {
      fulfillment = {
        pickupEnabled,
        deliveryEnabled,
        pickupLocationLabel: fc.pickup?.locationLabel ?? undefined,
        dates: listFulfilmentDates(new Date(), fc),
        pickupWindows: (fc.pickup?.windows ?? []).map((w) => w.label),
        deliveryWindows: (fc.delivery?.windows ?? []).map((w) => w.label),
        zones: (fc.delivery?.zones ?? []).map((z) => ({
          name: z.name,
          feeMinor: z.fee,
          feeFormatted: formatMoney(z.fee, currency),
          areasNote: z.areasNote ?? undefined,
        })),
      }
    }
  }

  const { theme } = await resolveActiveTheme(store)
  const layout = resolveThemeLayout(theme?.layout)

  return (
    <div className="flex min-h-screen flex-col">
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <Header storeName={storeName} settings={settings} layout={layout.header} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <h1
          className="mb-8 text-3xl font-bold tracking-tight text-(--color-heading)"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Checkout
        </h1>

        <TrackOnMount
          event="begin_checkout"
          params={{ currency, value: toMajor(subtotalMinor), items: gaItems }}
        />

        <CheckoutForm
          action={startCheckout}
          summaryLines={summaryLines}
          subtotalFormatted={subtotalFormatted}
          totalFormatted={totalFormatted}
          currency={currency}
          subtotalMinor={subtotalMinor}
          fulfillment={fulfillment}
          hasGiftCardItem={hasGiftCardItem}
          tax={taxConfig}
          initialEmail={customer?.email ?? undefined}
          initialName={customer?.name ?? undefined}
          initialAddress={
            firstAddress
              ? {
                  line1: firstAddress.line1 ?? undefined,
                  line2: firstAddress.line2 ?? undefined,
                  city: firstAddress.city ?? undefined,
                  state: firstAddress.state ?? undefined,
                  postalCode: firstAddress.postalCode ?? undefined,
                  country: firstAddress.country ?? undefined,
                }
              : undefined
          }
        />
      </main>

      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
