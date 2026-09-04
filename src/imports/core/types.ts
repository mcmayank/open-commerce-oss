/**
 * The canonical shape every import source normalises to.
 *
 * Nothing downstream of an adapter knows which platform a product came from —
 * that is the whole point of the boundary. Adding a third source must be one
 * folder plus one registry line, exactly like adding a payment provider.
 */
import type { SafeFetch } from './fetch'

/**
 * Stable codes, not prose: the review UI renders these as chips.
 *
 * Declared as a runtime array so `ImportItems.warnings` can derive its select
 * options from it. A code an adapter can raise is therefore always a code the
 * database will accept — restating the list in the collection would let the two
 * drift the first time one is added.
 */
export const IMPORT_WARNINGS = [
  'no_price',
  'no_images',
  'many_variants',
  'currency_mismatch',
  'boilerplate_description',
  'variants_unavailable',
  'duplicate_sku',
  /** The source's public feed does not expose stock (Shopify `products.json`). */
  'inventory_unknown',
] as const

export type ImportWarning = (typeof IMPORT_WARNINGS)[number]

export type SourceImage = {
  externalId: string
  url: string
  alt?: string
  position: number
}

export type SourceVariant = {
  externalId: string
  title: string
  /** Index-parallel to `SourceProduct.options`. */
  optionValues: string[]
  /** Integer minor units, per CLAUDE.md. Never a float, never a decimal string. */
  priceMinor: number
  /** ISO 4217, as reported by the source. */
  currency: string
  compareAtMinor?: number
  sku?: string
  barcode?: string
  /**
   * `null` means the source did not say, which is NOT the same as zero. The
   * import phase turns null into the collection's required `stock: 0` and
   * raises `inventory_unknown`, so a merchant is never quietly told their whole
   * catalog is out of stock.
   */
  inventoryQuantity?: number | null
  imageExternalId?: string
  weightGrams?: number | null
}

export type SourceProduct = {
  /** Stable id on the source platform. Drives re-import idempotency. */
  externalId: string
  sourceUrl: string
  title: string
  /**
   * ALREADY SANITISED by the adapter. This is third-party HTML that will render
   * on a *.niblr.store subdomain, so `<script>`, event handlers and
   * `javascript:` URLs must be gone before it reaches this type.
   */
  descriptionHtml: string
  vendor?: string
  productType?: string
  tags: string[]
  options: { name: string; values: string[] }[]
  variants: SourceVariant[]
  images: SourceImage[]
  status: 'active' | 'draft'
  warnings: ImportWarning[]
}

/** A positive answer from `detect`. */
export type DetectResult = {
  /** Shown to the merchant, e.g. "Shopify store". */
  note: string
}

export type SourceContext = {
  origin: URL
  /**
   * The TARGET store's currency, from `StoreSettings`. Shopify's feed carries
   * no currency at all so prices are read as this; WooCommerce declares its own
   * and is refused when the two disagree. See `docs/PRODUCT-IMPORT.md` Task 2.
   */
  storeCurrency: string
  /** The only network access an adapter gets. */
  fetch: SafeFetch
  /** Stop yielding once this many products have been produced. */
  maxProducts: number
  log: (message: string) => void
}

export interface ImportSource {
  id: string
  label: string
  /**
   * Cheap probe. Returns null if this adapter does not handle the origin.
   *
   * Takes the fetcher explicitly: detection is a network operation (a header
   * probe, a namespace listing) and the spec's original signature gave it no
   * way to reach the network without importing `safeFetch` directly, which
   * `no-direct-fetch.test.ts` forbids.
   */
  detect(origin: URL, safeFetch: SafeFetch): Promise<DetectResult | null>
  /** Yields normalised products, paging internally. */
  listProducts(ctx: SourceContext): AsyncIterable<SourceProduct>
}
