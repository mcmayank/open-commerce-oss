import { notFound } from 'next/navigation'
import { mediaSrc, mediaSrcSet, mediaDimensions } from '@/lib/image'
import { ProductGallery, type GalleryImage } from '../../components/ProductGallery'
import React from 'react'
// Always the shared wrapper, never `RichText` from @payloadcms/richtext-lexical/react
// directly: the wrapper is what installs the sanitizing link/autolink converters,
// so importing the library renderer here would render a merchant-authored
// `javascript:`/`data:` href verbatim. Guarded by src/blocks/href-sanitization.test.tsx.
import { SharedRichText } from '@/blocks/lib/RichText'
import type { Metadata } from 'next'
import { getProductBySlug, getStore, getStoreSettings, storeBaseUrl } from '@/lib/storefront'
import { buildProductJsonLd, lexicalToPlainText } from '@/lib/structured-data'
import { resolveActiveTheme } from '@/lib/preview-theme'
import { resolveThemeLayout } from '@/themes/layout'
import { showsNiblrBranding } from '@/lib/branding'
import ThemePreviewBanner from '../../components/ThemePreviewBanner'
import { formatMoney } from '@/lib/money'
import { isInStock } from '@/lib/inventory'
import type { Media } from '@/payload-types'
import Footer from '../../components/Footer'
import Header from '../../components/Header'
import StoreTheme from '../../components/StoreTheme'
import StoreCustomCss from '../../components/StoreCustomCss'
import VariantSelector from './VariantSelector'
import { AddToCartButton } from './AddToCartButton'
import { addToCart } from '../../cart/actions'
import { TrackOnMount } from '@/components/analytics/TrackOnMount'
import { toMajor } from '@/lib/analytics'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>
}): Promise<Metadata> {
  const { tenant, slug } = await params
  const store = await getStore(tenant)
  if (!store) return {}
  const [settings, product] = await Promise.all([
    getStoreSettings(store.id),
    getProductBySlug(store.id, slug),
  ])
  if (!product) return {}
  return { title: `${product.title} — ${settings?.storeName ?? store.name}` }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>
}) {
  const { tenant, slug } = await params

  const store = await getStore(tenant)
  if (!store) notFound()

  const [settings, product] = await Promise.all([
    getStoreSettings(store.id),
    getProductBySlug(store.id, slug),
  ])

  if (!product) notFound()

  const { theme, previewSlug } = await resolveActiveTheme(store)

  const storeName = settings?.storeName ?? store.name
  const currency = settings?.currency ?? 'AED'
  const layout = resolveThemeLayout(theme?.layout)

  // Resolve images array to populated Media objects
  const images: Media[] = (product.images ?? []).flatMap((img) =>
    typeof img === 'object' && img !== null ? [img as Media] : [],
  )

  // Plain, serializable data for the client gallery — Media objects carry methods
  // and must not cross the server/client boundary.
  const galleryImages: GalleryImage[] = images.flatMap((m, i) => {
    const src = mediaSrc(m)
    if (!src) return []
    const dims = mediaDimensions(m)
    return [
      {
        id: (m.id as string | number | undefined) ?? i,
        src,
        srcSet: mediaSrcSet(m),
        alt: m.alt ?? `${product.title} image ${i + 1}`,
        width: dims?.width,
        height: dims?.height,
      },
    ]
  })

  const baseUrl = storeBaseUrl(store.slug)
  const productUrl = `${baseUrl}/products/${product.slug}`
  const imageUrls = images
    .map((m) => m.url)
    .filter((u): u is string => !!u)
    .map((u) => (u.startsWith('http') ? u : `${baseUrl}${u}`))

  const productJsonLd = buildProductJsonLd({
    name: product.title,
    description: product.description ? lexicalToPlainText(product.description) : undefined,
    images: imageUrls,
    currency,
    issuesGiftCard: product.issuesGiftCard,
    price: product.price,
    stock: product.stock,
    variants: (product.variants ?? []).map((v) => ({ price: v.price, stock: v.stock })),
    specifications: (product.specifications ?? []).map((s) => ({ label: s.label, value: s.value })),
    url: productUrl,
    storeName,
  })

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0
  const basePrice = formatMoney(product.price, currency)
  const inStock = isInStock(product, product.stock)

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {previewSlug && <ThemePreviewBanner slug={previewSlug} />}
      <StoreTheme settings={settings} preset={theme?.tokens} />
      <StoreCustomCss settings={settings} />
      <TrackOnMount
        event="view_item"
        params={{
          currency,
          value: toMajor(product.price),
          items: [
            { item_id: String(product.id), item_name: product.title, price: toMajor(product.price) },
          ],
        }}
      />
      <Header storeName={storeName} settings={settings} layout={layout.header} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-(--color-text-muted)">
          <a href="/" className="hover:text-(--color-text) transition-colors">Home</a>
          <span className="mx-2">/</span>
          <a href="/products" className="hover:text-(--color-text) transition-colors">Products</a>
          <span className="mx-2">/</span>
          <span className="text-(--color-heading)">{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Image gallery */}
          <div className="space-y-4">
            {galleryImages.length > 0 ? (
              <ProductGallery images={galleryImages} title={product.title} />
            ) : (
              /* No image placeholder */
              <div className="flex aspect-square items-center justify-center rounded-xl bg-(--color-surface-alt)">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-24 w-24 text-(--color-border)"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Product info + add-to-cart */}
          <div className="flex flex-col gap-6">
            <div>
              <h1
                className="text-3xl font-bold tracking-tight text-(--color-heading)"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {product.title}
              </h1>

              {/* Base price shown only when no variants */}
              {!hasVariants && (
                <p className="mt-2 text-2xl font-bold text-(--color-heading)">{basePrice}</p>
              )}
            </div>

            {/* Stock indicator (for non-variant products) */}
            {!hasVariants && (
              <p className={`text-sm font-medium ${inStock ? 'text-green-600' : 'text-red-500'}`}>
                {inStock ? 'In stock' : 'Out of stock'}
              </p>
            )}

            <form
              action={addToCart}
              className="flex flex-col gap-4"
            >
              {/* Hidden product ID for the server action */}
              <input type="hidden" name="productId" value={product.id} />

              {hasVariants ? (
                /* Client-side variant selector manages variantId + submit */
                <VariantSelector
                  options={product.options ?? []}
                  variants={product.variants!}
                  currency={currency}
                  productId={String(product.id)}
                  productTitle={product.title}
                  issuesGiftCard={product.issuesGiftCard}
                />
              ) : (
                /* Plain quantity + add to cart for products without variants */
                <>
                  <div className="flex items-center gap-3">
                    <label htmlFor="qty" className="text-sm font-medium text-(--color-text)">
                      Quantity
                    </label>
                    <input
                      id="qty"
                      name="qty"
                      type="number"
                      min={1}
                      defaultValue={1}
                      className="w-20 rounded-lg border border-(--color-border) px-3 py-2 text-center text-sm focus:border-(--color-primary) focus:outline-none"
                    />
                  </div>
                  <AddToCartButton
                    productId={String(product.id)}
                    productTitle={product.title}
                    price={product.price}
                    currency={currency}
                    inStock={inStock}
                  />
                </>
              )}
            </form>

            {/* Rich-text description */}
            {product.description && (
              <div className="border-t border-(--color-border) pt-6 text-(--color-text)">
                <h2 className="mb-3 text-lg font-semibold text-(--color-heading)">Description</h2>
                {/* `store-prose` goes on the renderer's own wrapper, not this
                    outer div: its rhythm rules use `>` combinators, and the
                    lexical nodes are children of the wrapper RichText emits.
                    It also keeps the section heading above out of scope. */}
                <SharedRichText
                  data={product.description}
                  className="store-prose text-sm leading-relaxed"
                />
              </div>
            )}

            {/* Structured specifications */}
            {Array.isArray(product.specifications) && product.specifications.length > 0 && (
              <div className="border-t border-(--color-border) pt-6">
                <h2 className="mb-3 text-lg font-semibold text-(--color-heading)">Specifications</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {product.specifications.map((spec, i) => (
                      <tr key={spec.id ?? i} className="border-b border-(--color-border) last:border-0">
                        <th className="py-2 pr-4 text-left font-medium text-(--color-text-muted) align-top w-1/3">
                          {spec.label}
                        </th>
                        <td className="py-2 text-(--color-text)">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer storeName={storeName} layout={layout.footer} showBranding={showsNiblrBranding(store)} />
    </div>
  )
}
