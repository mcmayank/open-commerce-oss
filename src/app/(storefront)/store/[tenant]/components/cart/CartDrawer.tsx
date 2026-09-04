'use client'
import * as React from 'react'
import Link from 'next/link'
import { useCart } from './CartProvider'
import { formatMoney } from '@/lib/money'

export function CartDrawer() {
  const { summary, isOpen, closeDrawer, setQty, remove, pending } = useCart()
  const closeBtnRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer() }
    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, closeDrawer])

  React.useEffect(() => {
    if (isOpen) closeBtnRef.current?.focus()
  }, [isOpen])

  return (
    <div aria-hidden={!isOpen} className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}>
      {/* Scrim */}
      <button
        aria-label="Close cart"
        onClick={closeDrawer}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        inert={!isOpen}
        className={`absolute right-0 top-0 flex h-full w-[min(420px,100%)] flex-col bg-(--color-surface) text-(--color-text) shadow-xl transition-transform duration-300 motion-reduce:transition-none ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between border-b border-(--color-border) px-5 py-4">
          <h2 className="text-lg font-semibold text-(--color-heading)">Your cart ({summary.count})</h2>
          <button ref={closeBtnRef} onClick={closeDrawer} className="text-2xl leading-none text-(--color-text)" aria-label="Close">&times;</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {summary.lines.length === 0 ? (
            <p className="py-10 text-center opacity-70">Your cart is empty.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {summary.lines.map((l) => (
                <li key={`${l.productId}:${l.variantId ?? ''}`} className="flex gap-3">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden bg-(--color-surface-alt)" style={{ borderRadius: 'var(--radius-card)' }}>
                    {l.image ? (
                      <img
                        src={l.image}
                        srcSet={l.imageSrcSet}
                        sizes="96px"
                        alt={l.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium leading-snug text-(--color-heading)">{l.title}</span>
                    {l.variantTitle ? <span className="text-xs opacity-70">{l.variantTitle}</span> : null}
                    <span className="text-sm" style={{ color: 'var(--color-primary)' }}>{formatMoney(l.unitPrice, summary.currency)}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <button disabled={pending} onClick={() => setQty(l, l.qty - 1)} className="h-6 w-6 border border-(--color-border)" aria-label="Decrease quantity">−</button>
                      <span className="min-w-6 text-center text-sm">{l.qty}</span>
                      <button disabled={pending} onClick={() => setQty(l, l.qty + 1)} className="h-6 w-6 border border-(--color-border)" aria-label="Increase quantity">+</button>
                      <button disabled={pending} onClick={() => remove(l)} className="ml-auto text-xs underline opacity-70" aria-label="Remove item">Remove</button>
                    </div>
                  </div>
                  <span className="font-semibold text-(--color-heading)">{formatMoney(l.lineTotal, summary.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-(--color-border) px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="opacity-70">Subtotal</span>
            <span className="text-lg font-semibold text-(--color-heading)">{formatMoney(summary.total, summary.currency)}</span>
          </div>
          <Link href="/checkout" onClick={closeDrawer} aria-disabled={summary.count === 0}
            className={`block w-full py-3 text-center text-sm font-semibold text-(--color-primary-contrast) ${summary.count === 0 ? 'pointer-events-none opacity-40' : ''}`}
            style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-button)' }}>
            Checkout
          </Link>
          <Link href="/cart" onClick={closeDrawer} className="mt-2 block w-full py-2 text-center text-sm underline opacity-80">View cart</Link>
        </footer>
      </aside>
    </div>
  )
}
