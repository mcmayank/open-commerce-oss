/**
 * Pure, dependency-free inventory predicates.
 *
 * ONE place decides whether a product's `stock` number means anything, because
 * the answer is consumed by six unrelated surfaces — the PDP, the product card,
 * the variant selector, the JSON-LD builder, the post-payment stock decrement
 * and the dashboard low-stock nudge. Inlining `product.issuesGiftCard` at each
 * of those is the shape that lets one site drift: the storefront would let a
 * card be bought while the reconciler quietly decremented it to zero, or the
 * JSON-LD would publish `OutOfStock` to Google for something that is always
 * available.
 *
 * Lives outside `orders.ts` / any collection module and takes a minimal
 * structural type rather than the generated `Product`, so it is unit-testable
 * without pulling in the Payload config — same reason `orders-math.ts` exists.
 *
 * Quantities are integers. Nothing here does arithmetic on them.
 */

/** The only thing these predicates need to know about a product. */
export type InventoryProduct = {
  issuesGiftCard?: boolean | null
}

/**
 * Whether `stock` is a real number about a real thing on a shelf.
 *
 * False for a gift-card product. A gift card is generated on demand at payment
 * time (`src/lib/gift-cards/`), so there is no finite supply of them: the
 * product-level and variant-level `stock` columns exist only because the
 * collection schema requires them, and they stay at the `defaultValue: 0` a
 * merchant is never asked to change. Treated as inventory, that 0 means a
 * freshly created gift card renders "Out of stock" and cannot be bought at all.
 */
export function tracksInventory(product: InventoryProduct | null | undefined): boolean {
  return product?.issuesGiftCard !== true
}

/**
 * Whether a product (or one of its variants) can be bought right now.
 *
 * `stock` is only consulted for products that track inventory; a gift card is
 * always available, at the product level and at every denomination variant.
 * Fixed denominations are the expected way to model a gift card — 50 / 100 /
 * 200 as three variants — and each of those carries its own `stock: 0`, so
 * gating a denomination is the same bug one level down.
 */
export function isInStock(
  product: InventoryProduct | null | undefined,
  stock: number | null | undefined,
): boolean {
  if (!tracksInventory(product)) return true
  return (stock ?? 0) > 0
}
