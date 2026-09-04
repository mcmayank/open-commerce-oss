export type CartLine = { productId: string; variantId?: string; qty: number }
export type Cart = CartLine[]

const sameLine = (a: CartLine, productId: string, variantId?: string) =>
  a.productId === productId && (a.variantId ?? undefined) === (variantId ?? undefined)

export function parseCart(raw: string | undefined | null): Cart {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  return data
    .map((l): CartLine | null => {
      if (!l || typeof l !== 'object') return null
      const line = l as Record<string, unknown>
      const productId = String(line.productId ?? '')
      const qty = Math.floor(Number(line.qty))
      if (!productId || !Number.isFinite(qty) || qty < 1) return null
      const variantId = line.variantId ? String(line.variantId) : undefined
      return variantId ? { productId, variantId, qty } : { productId, qty }
    })
    .filter((l): l is CartLine => l !== null)
}

export const serializeCart = (cart: Cart): string => JSON.stringify(cart)

export function addItem(cart: Cart, productId: string, variantId: string | undefined, qty: number): Cart {
  const q = Math.max(1, Math.floor(qty))
  const idx = cart.findIndex((l) => sameLine(l, productId, variantId))
  if (idx === -1) {
    const line: CartLine = variantId ? { productId, variantId, qty: q } : { productId, qty: q }
    return [...cart, line]
  }
  return cart.map((l, i) => (i === idx ? { ...l, qty: l.qty + q } : l))
}

export function updateQty(cart: Cart, productId: string, variantId: string | undefined, qty: number): Cart {
  const q = Math.floor(qty)
  if (q < 1) return removeItem(cart, productId, variantId)
  return cart.map((l) => (sameLine(l, productId, variantId) ? { ...l, qty: q } : l))
}

export const removeItem = (cart: Cart, productId: string, variantId: string | undefined): Cart =>
  cart.filter((l) => !sameLine(l, productId, variantId))

export const cartCount = (cart: Cart): number => cart.reduce((n, l) => n + l.qty, 0)
