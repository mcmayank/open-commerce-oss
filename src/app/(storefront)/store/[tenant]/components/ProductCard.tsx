import Link from 'next/link'
import React from 'react'
import { formatMoney } from '@/lib/money'
import type { Media, Product } from '@/payload-types'
import { AddToCartCardButton } from './cart/AddToCartCardButton'
import { mediaSrcSet } from '@/lib/image'
import { isInStock } from '@/lib/inventory'

interface ProductCardProps {
  product: Product
  currency: string
}

/**
 * The card is a STRETCHED LINK, not an anchor wrapped around the whole card.
 *
 * The add-to-cart button used to sit inside that anchor. That is invalid HTML —
 * an `<a>`'s content model excludes interactive content — and it did not merely
 * offend a validator: clicking "Add to cart" opened the cart drawer AND
 * navigated to the product page. The button's own handler calls
 * `preventDefault()` and `stopPropagation()`, and neither stopped the anchor.
 *
 * It survived because the failure is timing-shaped. Against `next dev` the RSC
 * navigation was slow enough that the drawer was still on screen when the e2e
 * assertion ran, so the suite was green; against a production build the
 * navigation lands immediately and takes the drawer with it. A shopper on the
 * live site got yanked to the product page every time they added from a card.
 *
 * So the anchor now covers the card through an `::after` overlay pinned to this
 * article, and every interactive control sits ABOVE that overlay on
 * `relative z-10`. Clicking anywhere inert — image, title, price — still
 * navigates; clicking a control does only what that control does.
 */
export default function ProductCard({ product, currency }: ProductCardProps) {
  const firstImage =
    product.images && product.images.length > 0
      ? typeof product.images[0] === 'object'
        ? (product.images[0] as Media)
        : null
      : null

  const imageUrl = firstImage?.url ?? null
  const href = `/products/${product.slug}`

  return (
    <article
      className="group relative flex flex-col overflow-hidden border border-(--color-border) bg-(--color-surface) shadow-sm hover:shadow-md transition-shadow"
      style={{ borderRadius: 'var(--radius-card)' }}
    >
      {/* Product image */}
      <div className="relative aspect-square overflow-hidden bg-(--color-surface-alt)">
        {imageUrl ? (
          <img
            src={imageUrl}
            srcSet={mediaSrcSet(firstImage)}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            alt={firstImage?.alt ?? product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-(--color-border)"
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

      {/* Product info */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-medium text-(--color-heading) leading-snug transition-opacity group-hover:opacity-80 line-clamp-2">
          {/* The overlay that makes the whole card clickable. */}
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {product.title}
          </Link>
        </h3>

        {/* Price + action on one line (price left, button right) */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2">
          <p className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
            {formatMoney(product.price, currency)}
          </p>
          {Array.isArray(product.variants) && product.variants.length > 0 ? (
            <Link
              href={href}
              className="relative z-10 shrink-0 px-5 py-2.5 text-sm font-medium text-(--color-primary-contrast) transition-opacity group-hover:opacity-90"
              style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-button)' }}
            >
              Choose options
            </Link>
          ) : (
            <AddToCartCardButton
              productId={String(product.id)}
              inStock={isInStock(product, product.stock)}
              className="relative z-10 shrink-0 px-5 py-2.5 text-sm font-medium text-(--color-primary-contrast) transition-opacity hover:opacity-90 disabled:opacity-40"
            />
          )}
        </div>
      </div>
    </article>
  )
}
