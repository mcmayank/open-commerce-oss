'use client'
import React from 'react'
import { trackEvent } from '@/components/analytics/track'
import { toMajor } from '@/lib/analytics'

/**
 * Submit button for non-variant products. Same markup/styling as the previous
 * inline button, plus a GA4 add_to_cart on click. Reads the sibling `qty` input
 * off the enclosing form for an accurate quantity.
 */
export function AddToCartButton({
  productId,
  productTitle,
  price,
  currency,
  inStock,
}: {
  productId: string
  productTitle: string
  price: number
  currency: string
  inStock: boolean
}) {
  return (
    <button
      type="submit"
      disabled={!inStock}
      onClick={(e) => {
        const form = e.currentTarget.form
        const qty = Number((form?.elements.namedItem('qty') as HTMLInputElement | null)?.value) || 1
        trackEvent('add_to_cart', {
          currency,
          value: toMajor(price) * qty,
          items: [{ item_id: productId, item_name: productTitle, price: toMajor(price), quantity: qty }],
        })
      }}
      className="w-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-button)' }}
    >
      {inStock ? 'Add to Cart' : 'Unavailable'}
    </button>
  )
}
