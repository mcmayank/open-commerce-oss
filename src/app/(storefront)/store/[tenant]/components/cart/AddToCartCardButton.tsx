'use client'
import * as React from 'react'
import { useCart } from './CartProvider'

export function AddToCartCardButton({
  productId,
  inStock,
  className,
}: {
  productId: string
  inStock: boolean
  /** Override the default full-width styling (e.g. a compact inline pill). */
  className?: string
}) {
  const { add, pending } = useCart()
  return (
    <button
      type="button"
      disabled={!inStock || pending}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void add(productId) }}
      className={
        className ??
        'block w-full py-2 text-center text-sm font-medium text-(--color-primary-contrast) transition-opacity hover:opacity-90 disabled:opacity-40'
      }
      style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-button)' }}
    >
      {inStock ? 'Add to cart' : 'Out of stock'}
    </button>
  )
}
