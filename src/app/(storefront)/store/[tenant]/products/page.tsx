import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import React from 'react'
import { getStore, getStoreSettings, listCategories, listProducts } from '@/lib/storefront'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import { showsNiblrBranding } from '@/lib/branding'
import ThemePreviewBanner from '../components/ThemePreviewBanner'
import Footer from '../components/Footer'
import Header from '../components/Header'
import StoreTheme from '../components/StoreTheme'
import StoreCustomCss from '../components/StoreCustomCss'
import ProductCard from '../components/ProductCard'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>
}): Promise<Metadata> {
  const { tenant } = await params
  const store = await getStore(tenant)
  if (!store) return {}
  const settings = await getStoreSettings(store.id)
  return { title: `Menu — ${settings?.storeName ?? store.name}` }
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ category?: string }>
}) {
  const { tenant } = await params
  const { category } = await searchParams

  const store = await getStore(tenant)
  if (!store) notFound()

  const [settings, categories] = await Promise.all([
    getStoreSettings(store.id),
    listCategories(store.id),
  ])

  // Accept either a category id or a slug in ?category= (footer links use slugs).
  const matched = category
    ? categories.find((c) => String(c.id) === category || c.slug === category)
    : undefined
  const activeCategory = matched ? String(matched.id) : undefined

  const products = await listProducts(store.id, { categoryId: activeCategory })

  const { theme, previewSlug } = await resolveActiveTheme(store)

  const storeName = settings?.storeName ?? store.name
  const currency = settings?.currency ?? 'AED'
  const layout = resolveThemeLayout(theme?.layout)

  return (
    <div className="flex min-h-screen flex-col">
      {previewSlug && <ThemePreviewBanner slug={previewSlug} />}
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <StoreCustomCss settings={settings} />
      <Header storeName={storeName} settings={settings} layout={layout.header} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        {/* Page heading + category filters */}
        <div className="mb-8">
          <h1
            className="mb-4 text-3xl font-bold tracking-tight text-(--color-heading)"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Products
          </h1>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <a
                href="/products"
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  !category
                    ? 'bg-(--color-primary) text-(--color-primary-contrast)'
                    : 'border border-(--color-border) text-(--color-text-muted) hover:bg-(--color-surface-alt)'
                }`}
              >
                All
              </a>
              {categories.map((cat) => (
                <a
                  key={cat.id}
                  href={`/products?category=${cat.id}`}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    category === String(cat.id)
                      ? 'bg-(--color-primary) text-(--color-primary-contrast)'
                      : 'border border-(--color-border) text-(--color-text-muted) hover:bg-(--color-surface-alt)'
                  }`}
                >
                  {cat.title}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Product grid or empty state */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-alt) py-24 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mb-4 h-12 w-12 text-(--color-border)"
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
            <p className="text-lg font-medium text-(--color-text-muted)">No products yet</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">Check back soon — new products are on their way.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} currency={currency} />
            ))}
          </div>
        )}
      </main>

      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
