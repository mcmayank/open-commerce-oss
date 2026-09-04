import { cookies } from 'next/headers'
import { mediaSrcSet } from '@/lib/image'
import type { Cart } from '@/lib/cart'
import { parseCart } from '@/lib/cart'
import type { Media, Product } from '@/payload-types'
import { orderTax, type TaxConfig } from '@/lib/tax'
import { taxableBaseOf } from '@/lib/orders-math'

export type CartSummaryLine = {
  productId: string
  variantId?: string
  qty: number
  title: string
  variantTitle?: string
  unitPrice: number
  lineTotal: number
  slug: string
  image?: string
  /** srcset for `image`; undefined for media with no generated variants. */
  imageSrcSet?: string
  /**
   * Set from `product.issuesGiftCard`. Kept on the line so `taxableBaseOf` can
   * exclude it: selling a gift card is taking a deposit, not making a taxable
   * supply, and the VAT lands later on whatever the card buys. Still counted in
   * `total` — the shopper pays for it.
   *
   * This field's absence WAS the bug. With no way to express the exclusion, the
   * cart taxed the full line total and quoted AED 134.40 on a cart the order
   * charged AED 129.40 for.
   */
  isGiftCard: boolean
}
export type CartSummary = {
  lines: CartSummaryLine[]
  count: number
  total: number
  currency: string
  /**
   * VAT to show the shopper BEFORE they pay, not just on the receipt.
   *
   * Inclusive is informational — the total does not move, so the label reads
   * "Includes VAT (5%)". Exclusive is added to `total`, so it reads "VAT (5%)".
   * Null when the store is not registered: an unregistered merchant must not
   * display a VAT line at all.
   */
  tax: { label: string; amountMinor: number; inclusive: boolean } | null
}

function firstImage(product: Product): Media | null {
  const img = product.images?.[0]
  return img && typeof img === 'object' ? (img as Media) : null
}

function firstImageUrl(product: Product): string | undefined {
  return firstImage(product)?.url ?? undefined
}

/** Pure: enrich cart lines against already-fetched products. Drops lines whose
 *  product/variant no longer exists (self-healing), mirroring the cart page. */
export function buildCartSummary(
  cart: Cart,
  products: Product[],
  currency: string,
  taxConfig?: TaxConfig | null,
): CartSummary {
  const map = new Map<string, Product>(products.map((p) => [String(p.id), p]))
  const lines: CartSummaryLine[] = []
  for (const line of cart) {
    const product = map.get(line.productId)
    if (!product) continue
    let unitPrice = product.price
    let variantTitle: string | undefined
    if (line.variantId) {
      const variant = (product.variants ?? []).find((v) => v.id === line.variantId)
      if (!variant) continue
      unitPrice = variant.price
      variantTitle = variant.title ?? undefined
    }
    lines.push({
      productId: line.productId,
      variantId: line.variantId,
      qty: line.qty,
      title: product.title,
      variantTitle,
      unitPrice,
      lineTotal: unitPrice * line.qty,
      slug: product.slug,
      image: firstImageUrl(product),
      imageSrcSet: mediaSrcSet(firstImage(product)),
      isGiftCard: product.issuesGiftCard === true,
    })
  }
  const lineTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)

  // Estimated: shipping and discounts aren't known until checkout, so both are
  // zero here and this is what the shopper can see now. The authoritative
  // figure is computed again in `buildOrderFromCart` when the order is placed.
  //
  // The base is `taxableBaseOf` — the ORDER PATH'S OWN function, the same one
  // `buildOrderFromCart` and the checkout summary call — so gift-card lines are
  // excluded here exactly as they are there, and all three surfaces agree by
  // construction. This used to tax `lineTotal` outright, which over-stated the
  // tax by taxing a gift card: the one thing the feature exists never to do.
  const taxableBase = taxableBaseOf(lines, 0, 0)
  const t = taxConfig?.enabled ? orderTax(taxableBase, taxConfig) : null

  return {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    // `taxToAdd`, never `taxAmount` — mirroring `buildOrderFromCart`. Inclusive
    // leaves the total alone (the shopper pays the listed price); exclusive
    // adds. Note the tax is added to the FULL `lineTotal`, not to the taxable
    // base: the gift card is untaxed but still very much paid for.
    total: lineTotal + (t?.taxToAdd ?? 0),
    currency,
    tax: t
      ? {
          label: taxConfig!.pricesIncludeTax
            ? `Includes VAT (${taxConfig!.rate}%)`
            : `VAT (${taxConfig!.rate}%)`,
          amountMinor: t.taxAmount,
          inclusive: taxConfig!.pricesIncludeTax,
        }
      : null,
  }
}

/** Server: fetch tenant-scoped products for the cart and build the summary.
 *  `@/lib/storefront` is imported dynamically (not at module scope) so this
 *  file stays importable in unit tests that only exercise `buildCartSummary` —
 *  storefront.ts eagerly instantiates a Payload client on import. */
export async function getCartSummary(store: { id: number | string }, currency: string): Promise<CartSummary> {
  const raw = (await cookies()).get('cart')?.value
  const cart = parseCart(raw)
  const productIds = [...new Set(cart.map((l) => l.productId))]
  if (productIds.length === 0) return buildCartSummary(cart, [], currency)
  const { getProductsByIds, getStoreSettings } = await import('@/lib/storefront')
  const [products, settings] = await Promise.all([
    getProductsByIds(store.id, productIds),
    getStoreSettings(store.id),
  ])
  return buildCartSummary(cart, products, currency, storeTaxConfig(settings))
}

/** Narrow StoreSettings' tax group to the calculator's config shape. */
export function storeTaxConfig(
  settings: { tax?: { enabled?: boolean | null; rate?: number | null; pricesIncludeTax?: boolean | null; registrationNumber?: string | null } | null } | null,
): TaxConfig | null {
  const t = settings?.tax
  if (!t?.enabled) return null
  return {
    enabled: true,
    rate: typeof t.rate === 'number' ? t.rate : 0,
    pricesIncludeTax: t.pricesIncludeTax !== false,
    registrationNumber: t.registrationNumber ?? null,
  }
}
