'use client'
import * as React from 'react'
import type { CartSummary } from '@/lib/cart-summary'
import { addToCartAction, setQtyAction, removeAction } from '../../cart/actions'

type Ctx = {
  summary: CartSummary
  isOpen: boolean
  pending: boolean
  openDrawer: () => void
  closeDrawer: () => void
  add: (productId: string, variantId?: string) => Promise<void>
  setQty: (l: { productId: string; variantId?: string }, qty: number) => Promise<void>
  remove: (l: { productId: string; variantId?: string }) => Promise<void>
}

const CartCtx = React.createContext<Ctx | null>(null)

export function useCart(): Ctx {
  const ctx = React.useContext(CartCtx)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export function CartProvider({ initial, children }: { initial: CartSummary; children: React.ReactNode }) {
  const [summary, setSummary] = React.useState<CartSummary>(initial)
  const [isOpen, setIsOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const openDrawer = React.useCallback(() => setIsOpen(true), [])
  const closeDrawer = React.useCallback(() => setIsOpen(false), [])

  const add = React.useCallback((productId: string, variantId?: string) => {
    setIsOpen(true)
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const next = await addToCartAction({ productId, variantId, qty: 1 })
        setSummary(next)
        resolve()
      })
    })
  }, [])

  const setQty = React.useCallback((l: { productId: string; variantId?: string }, qty: number) =>
    new Promise<void>((resolve) => {
      startTransition(async () => { setSummary(await setQtyAction({ ...l, qty })); resolve() })
    }), [])

  const remove = React.useCallback((l: { productId: string; variantId?: string }) =>
    new Promise<void>((resolve) => {
      startTransition(async () => { setSummary(await removeAction(l)); resolve() })
    }), [])

  const value: Ctx = { summary, isOpen, pending, openDrawer, closeDrawer, add, setQty, remove }
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>
}
