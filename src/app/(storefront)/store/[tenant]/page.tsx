import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import React from 'react'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getStore, getStoreSettings, listProducts, getPageBySlug, storeBaseUrl } from '@/lib/storefront'
import { buildPageMetadata } from '@/lib/seo'
import { buildPageJsonLd } from '@/lib/structured-data'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import { RenderBlocks } from '@/blocks'
import { entitlementsOf } from '@/entitlements'
import { showsNiblrBranding } from '@/lib/branding'
import Header from './components/Header'
import Footer from './components/Footer'
import StoreTheme from './components/StoreTheme'
import StoreCustomCss from './components/StoreCustomCss'
import ThemePreviewBanner from './components/ThemePreviewBanner'
import ProductCard from './components/ProductCard'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>
}): Promise<Metadata> {
  const { tenant } = await params
  const store = await getStore(tenant)
  if (!store) return {}
  const [settings, home] = await Promise.all([
    getStoreSettings(store.id),
    getPageBySlug(store.id, 'home'),
  ])
  const storeName = settings?.storeName ?? store.name
  // No home Page document → keep the simple store-name title.
  if (!home) return { title: storeName, description: settings?.description ?? undefined }
  return buildPageMetadata({
    page: home,
    settings,
    url: `${storeBaseUrl(store.slug)}/`,
    fallbackTitle: storeName,
  })
}

export default async function StoreHome({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params

  const store = await getStore(tenant)
  if (!store) notFound()

  const { theme, previewSlug } = await resolveActiveTheme(store)

  const [settings, home, products] = await Promise.all([
    getStoreSettings(store.id),
    getPageBySlug(store.id, 'home'),
    listProducts(store.id, { limit: 8 }),
  ])

  const storeName = settings?.storeName ?? store.name
  const currency = settings?.currency ?? 'AED'
  const description = settings?.description ?? null
  const layout = resolveThemeLayout(theme?.layout)

  const jsonLd = home
    ? buildPageJsonLd({ page: home, storeName, url: `${storeBaseUrl(store.slug)}/` })
    : null

  return (
    <div className="flex min-h-screen flex-col">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {previewSlug && <ThemePreviewBanner slug={previewSlug} />}
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <StoreCustomCss settings={settings} />
      <Header storeName={storeName} settings={settings} layout={layout.header} />

      {home?.layout?.length ? (
        <RenderBlocks
          blocks={home.layout}
          ctx={{
            tenantId: store.id,
            currency,
            premiumSections: (await entitlementsOf(store)).premiumSections,
            payload: await getPayload({ config }),
          }}
          schemes={theme?.blockSchemes}
          blockStyles={home.blockStyles as Record<string, unknown> | undefined}
          styleDefaults={settings?.blockStyleDefaults as Record<string, unknown> | undefined}
        />
      ) : (
        <>
          {/* Hero */}
          <section className="bg-gray-50 border-b border-gray-200">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                {storeName}
              </h1>
              {description && (
                <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600">{description}</p>
              )}
              <a
                href="/products"
                className="mt-8 inline-block rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
              >
                Shop All Products
              </a>
            </div>
          </section>

          {/* Product grid */}
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="mb-8 text-2xl font-semibold text-gray-900">
              {products.length > 0 ? 'Featured Products' : 'Catalog'}
            </h2>

            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-24 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mb-4 h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <p className="text-lg font-medium text-gray-500">No products yet</p>
                <p className="mt-1 text-sm text-gray-400">Check back soon — new products are on their way.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} currency={currency} />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
