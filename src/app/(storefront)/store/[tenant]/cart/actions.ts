'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getProductsByIds, getStoreSettings } from '@/lib/storefront'
import { resolveStoreFromHost } from '@/lib/tenant-host-server'
import { parseCart, serializeCart, addItem, updateQty, removeItem } from '@/lib/cart'
import { getCartSummary, buildCartSummary } from '@/lib/cart-summary'
import type { CartSummary } from '@/lib/cart-summary'
import { cookieSecure } from '@/lib/cookies'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: cookieSecure(),
} as const

/**
 * Add an item to the cart.
 * - Tenant is resolved from the request Host header (subdomain).
 * - Product existence and active status are validated against the resolved tenant.
 * - Variant membership is verified against the product.
 * - No price information is read from the form; prices are derived server-side on the cart page.
 */
export async function addToCart(formData: FormData) {
  const store = await resolveStoreFromHost()
  if (!store) return

  const productId = String(formData.get('productId') ?? '').trim()
  const variantIdRaw = String(formData.get('variantId') ?? '').trim()
  const variantId = variantIdRaw || undefined
  const qty = Math.max(1, Math.floor(Number(formData.get('qty') ?? 1) || 1))

  if (!productId) return

  // Guard: product must exist and be active for THIS tenant
  const products = await getProductsByIds(store.id, [productId])
  const product = products[0]
  if (!product) return

  // Guard: variantId must belong to this product
  if (variantId) {
    const hasVariant = (product.variants ?? []).some((v) => v.id === variantId)
    if (!hasVariant) return
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get('cart')?.value
  const cart = parseCart(raw)
  const updated = addItem(cart, productId, variantId, qty)

  cookieStore.set('cart', serializeCart(updated), COOKIE_OPTS)
  revalidatePath(`/store/${store.slug}/cart`)
}

/**
 * Update qty for a cart line. Resolves tenant from host to ensure
 * this action is invoked from a valid tenant subdomain.
 */
export async function setQty(formData: FormData) {
  const store = await resolveStoreFromHost()
  if (!store) return

  const productId = String(formData.get('productId') ?? '').trim()
  const variantIdRaw = String(formData.get('variantId') ?? '').trim()
  const variantId = variantIdRaw || undefined
  const qty = Math.floor(Number(formData.get('qty') ?? 0) || 0)

  if (!productId) return

  // Guard: product must exist and be active for THIS tenant
  const products = await getProductsByIds(store.id, [productId])
  if (products.length === 0) return

  const cookieStore = await cookies()
  const raw = cookieStore.get('cart')?.value
  const cart = parseCart(raw)
  const updated = updateQty(cart, productId, variantId, qty)

  cookieStore.set('cart', serializeCart(updated), COOKIE_OPTS)
  revalidatePath(`/store/${store.slug}/cart`)
}

/**
 * Remove a line from the cart. Resolves tenant from host to ensure
 * this action is invoked from a valid tenant subdomain.
 */
export async function removeFromCart(formData: FormData) {
  const store = await resolveStoreFromHost()
  if (!store) return

  const productId = String(formData.get('productId') ?? '').trim()
  const variantIdRaw = String(formData.get('variantId') ?? '').trim()
  const variantId = variantIdRaw || undefined

  if (!productId) return

  const cookieStore = await cookies()
  const raw = cookieStore.get('cart')?.value
  const cart = parseCart(raw)
  const updated = removeItem(cart, productId, variantId)

  cookieStore.set('cart', serializeCart(updated), COOKIE_OPTS)
  revalidatePath(`/store/${store.slug}/cart`)
}

/** Object-input add for client callers (cart drawer). Same validation as
 *  addToCart, but returns the fresh authoritative summary for reconciliation. */
export async function addToCartAction(input: {
  productId: string
  variantId?: string
  qty?: number
}): Promise<CartSummary> {
  const store = await resolveStoreFromHost()
  const settings = store ? await getStoreSettings(store.id) : null
  const currency = settings?.currency ?? 'AED'
  if (!store) return buildCartSummary([], [], currency)

  const productId = String(input.productId ?? '').trim()
  const variantId = input.variantId ? String(input.variantId).trim() || undefined : undefined
  const qty = Math.max(1, Math.floor(Number(input.qty ?? 1) || 1))
  if (!productId) return getCartSummary(store, currency)

  const products = await getProductsByIds(store.id, [productId])
  const product = products[0]
  if (!product) return getCartSummary(store, currency)
  if (variantId && !(product.variants ?? []).some((v) => v.id === variantId)) {
    return getCartSummary(store, currency)
  }

  const cookieStore = await cookies()
  const cart = parseCart(cookieStore.get('cart')?.value)
  cookieStore.set('cart', serializeCart(addItem(cart, productId, variantId, qty)), COOKIE_OPTS)
  revalidatePath(`/store/${store.slug}/cart`)
  return getCartSummary(store, currency)
}

export async function setQtyAction(input: { productId: string; variantId?: string; qty: number }): Promise<CartSummary> {
  const store = await resolveStoreFromHost()
  const currency = store ? (await getStoreSettings(store.id))?.currency ?? 'AED' : 'AED'
  if (!store) return buildCartSummary([], [], currency)
  const q = Math.floor(Number(input.qty))
  if (!Number.isFinite(q)) return getCartSummary(store, currency)
  const cookieStore = await cookies()
  const cart = parseCart(cookieStore.get('cart')?.value)
  const next = updateQty(cart, input.productId, input.variantId, q)
  cookieStore.set('cart', serializeCart(next), COOKIE_OPTS)
  revalidatePath(`/store/${store.slug}/cart`)
  return getCartSummary(store, currency)
}

export async function removeAction(input: { productId: string; variantId?: string }): Promise<CartSummary> {
  const store = await resolveStoreFromHost()
  const currency = store ? (await getStoreSettings(store.id))?.currency ?? 'AED' : 'AED'
  if (!store) return buildCartSummary([], [], currency)
  const cookieStore = await cookies()
  const cart = parseCart(cookieStore.get('cart')?.value)
  cookieStore.set('cart', serializeCart(removeItem(cart, input.productId, input.variantId)), COOKIE_OPTS)
  revalidatePath(`/store/${store.slug}/cart`)
  return getCartSummary(store, currency)
}
