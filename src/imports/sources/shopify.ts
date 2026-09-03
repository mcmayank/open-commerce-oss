/**
 * Shopify import adapter.
 *
 * Reads the storefront's public `/products.json`, which needs no credentials —
 * so a merchant never has to create an API key to try Niblr.
 *
 * Mechanics here were verified against live stores on 4 Aug 2026 (Task 0 of
 * `docs/PRODUCT-IMPORT.md`), not taken from documentation. Three of them are
 * counter-intuitive and are commented where they bite.
 */
import { sanitizeDescriptionHtml } from '../core/sanitize-html'
import { parseMinorExact } from '@/lib/money-exact'
import type { SafeFetch } from '../core/fetch'
import type {
  DetectResult,
  ImportSource,
  ImportWarning,
  SourceContext,
  SourceProduct,
  SourceVariant,
} from '../core/types'

// ── The shape the endpoint actually returns ──────────────────────────────────

export type ShopifyRawVariant = {
  id: number
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  /** A decimal string in MAJOR units, with no currency anywhere in the feed. */
  price: string
  compare_at_price: string | null
  sku: string | null
  grams: number | null
}

export type ShopifyRawProduct = {
  id: number
  handle: string
  title: string
  body_html: string | null
  vendor: string | null
  product_type: string | null
  tags: string[]
  options: { name: string; values: string[] }[]
  variants: ShopifyRawVariant[]
  images: { id: number; src: string; alt?: string | null; position: number }[]
}

/** Shopify clamps anything above this; 251 silently becomes 250. */
const PAGE_SIZE = 250

/**
 * Backstop only. The real limit is `page * limit <= 25000`, which at 250 per
 * page is 100 pages — this stops a misbehaving source well before that.
 */
const MAX_PAGES = 40

/** Over this, the review grid becomes unusable and the merchant should know. */
const MANY_VARIANTS = 100

/**
 * The pipeline caps stored images at 2000px wide anyway (`resizeOptions`), so
 * asking the CDN for that width costs nothing in quality and saves real
 * bandwidth on every image. If Shopify ever ignores the parameter we get the
 * master back, which is still correct — this degrades safely in both directions.
 */
function boundedImageUrl(src: string): string {
  return src.includes('?') ? `${src}&width=2000` : `${src}?width=2000`
}

function mapVariant(
  raw: ShopifyRawVariant,
  optionCount: number,
  currency: string,
): { variant: SourceVariant; priced: boolean } {
  const optionValues = [raw.option1, raw.option2, raw.option3]
    .slice(0, Math.max(optionCount, 1))
    .filter((v): v is string => typeof v === 'string' && v.length > 0)

  let priceMinor = 0
  let priced = false
  if (typeof raw.price === 'string' && raw.price.length > 0) {
    priceMinor = parseMinorExact(raw.price, currency)
    priced = true
  }

  const compareAt =
    typeof raw.compare_at_price === 'string' && raw.compare_at_price.length > 0
      ? parseMinorExact(raw.compare_at_price, currency)
      : undefined

  return {
    priced,
    variant: {
      externalId: String(raw.id),
      title: raw.title,
      optionValues,
      priceMinor,
      currency,
      compareAtMinor: compareAt,
      sku: raw.sku ?? undefined,
      // NOT zero. This endpoint does not expose inventory at all, and mapping
      // "unknown" to "none" would tell a merchant their whole catalog is out of
      // stock. The import phase turns null into the collection's required 0 and
      // keeps the `inventory_unknown` warning attached so it is visible.
      inventoryQuantity: null,
      weightGrams: raw.grams ?? null,
    },
  }
}

export function mapShopifyProduct(raw: ShopifyRawProduct, ctx: SourceContext): SourceProduct {
  const options = (raw.options ?? []).map((o) => ({ name: o.name, values: o.values ?? [] }))
  const mapped = (raw.variants ?? []).map((v) =>
    mapVariant(v, options.length, ctx.storeCurrency),
  )

  const images = (raw.images ?? []).map((img) => ({
    externalId: String(img.id),
    url: boundedImageUrl(img.src),
    alt: img.alt ?? undefined,
    position: img.position,
  }))

  const warnings: ImportWarning[] = ['inventory_unknown']
  if (images.length === 0) warnings.push('no_images')
  if (mapped.length === 0 || mapped.some((m) => !m.priced)) warnings.push('no_price')
  if (mapped.length > MANY_VARIANTS) warnings.push('many_variants')

  const skus = mapped.map((m) => m.variant.sku).filter(Boolean)
  if (new Set(skus).size !== skus.length) warnings.push('duplicate_sku')

  return {
    externalId: String(raw.id),
    sourceUrl: new URL(`/products/${raw.handle}`, ctx.origin).toString(),
    title: raw.title,
    // Third-party HTML, rendering on our subdomain. Sanitised here so nothing
    // downstream has to remember to.
    descriptionHtml: sanitizeDescriptionHtml(raw.body_html ?? ''),
    vendor: raw.vendor ?? undefined,
    productType: raw.product_type ?? undefined,
    tags: raw.tags ?? [],
    options,
    variants: mapped.map((m) => m.variant),
    images,
    // `products.json` only lists published products, so anything we can see is
    // live on the source. The import phase still writes drafts.
    status: 'active',
    warnings,
  }
}

// ── Detection ────────────────────────────────────────────────────────────────

async function detect(origin: URL, safeFetch: SafeFetch): Promise<DetectResult | null> {
  // Named `safeFetch`, not `fetch`: a parameter called `fetch` shadows the
  // global, so neither a reader nor `no-direct-fetch.test.ts` can tell which
  // one is being called.
  const response = await safeFetch(origin.toString())
  if (!response.ok) return null

  // Cheapest first: Shopify sets this on every storefront response.
  if (response.headers.get('x-shopid')) return { note: 'Shopify store' }

  if (response.body.toString('utf8').includes('cdn.shopify.com')) {
    return { note: 'Shopify store' }
  }

  return null
}

// ── Paging ───────────────────────────────────────────────────────────────────

function feedOff(status: number | undefined, origin: URL): Error {
  return new Error(
    `This Shopify store has its public product feed turned off ` +
      `(${origin.host} returned ${status ?? 'no response'}). ` +
      `The store owner can re-enable it, or the catalog can be imported from a CSV instead.`,
  )
}

async function* listProducts(ctx: SourceContext): AsyncIterable<SourceProduct> {
  let yielded = 0

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
    const url = new URL('/products.json', ctx.origin)
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('page', String(pageNumber))

    const response = await ctx.fetch(url.toString())
    if (!response.ok) throw feedOff(response.status, ctx.origin)

    let body: unknown
    try {
      body = JSON.parse(response.body.toString('utf8'))
    } catch {
      // A password-protected or non-Shopify origin answers with HTML.
      throw new Error(
        `${ctx.origin.host} did not return a Shopify product feed. ` +
          `Check the address is the storefront, and that the store is not password-protected.`,
      )
    }

    const record = body as { products?: unknown; errors?: unknown }

    // The `page * limit <= 25000` ceiling. It arrives as HTTP **200** with an
    // `errors` string and no `products` key, so this has to be checked before
    // touching `products` — reading `.length` here is what would throw.
    if (record.errors !== undefined) {
      ctx.log(
        `Stopped at page ${pageNumber}: Shopify will not serve beyond 25,000 products ` +
          `through the public feed (${String(record.errors)}).`,
      )
      return
    }

    if (!Array.isArray(record.products)) {
      throw new Error(`${ctx.origin.host} did not return a Shopify product feed.`)
    }

    const rawProducts = record.products as ShopifyRawProduct[]
    for (const raw of rawProducts) {
      if (yielded >= ctx.maxProducts) return
      yield mapShopifyProduct(raw, ctx)
      yielded++
    }

    // No total and no `next` link exist on this endpoint, so a short page is
    // the only positive signal that the catalog has ended.
    if (rawProducts.length < PAGE_SIZE) return
  }

  ctx.log(`Stopped after ${MAX_PAGES} pages; the remainder needs another run.`)
}

export const shopifySource: ImportSource = {
  id: 'shopify',
  label: 'Shopify',
  detect,
  listProducts,
}
