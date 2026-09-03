'use client'
import * as React from 'react'
import { useCart } from './CartProvider'

/** Header control: opens the CartDrawer and reflects the live item count. */
export function CartButton({ className }: { className?: string }) {
  const { summary, openDrawer } = useCart()
  return (
    <button type="button" onClick={openDrawer} className={className} aria-label={`Cart (${summary.count} items)`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="inline-block align-middle"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span className="hidden sm:inline align-middle ml-1.5">Cart</span>
      {summary.count > 0 ? (
        <span
          className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold align-middle"
          style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)' }}
        >
          {summary.count > 99 ? '99+' : summary.count}
        </span>
      ) : null}
    </button>
  )
}
