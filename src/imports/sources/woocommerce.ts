/**
 * WooCommerce import adapter, over the public Store API.
 *
 * `wc/store/v1` is read-only and unauthenticated, which is why it is used
 * instead of `wc/v3` — the latter needs a consumer key and secret, turning
 * onboarding into a credentials exercise before the merchant has seen anything.
 *
 * Mechanics verified against a live store on 4 Aug 2026 (Task 0 of
 * `docs/PRODUCT-IMPORT.md`). Note how little this has in common with the Shopify
 * adapter: opposite price representation, a hard error instead of a silent clamp
 * on over-limit paging, an authoritative page count, and variations that cost a
 * request each. That divergence is exactly why adapters own their own paging.
 */
import { sanitizeDescriptionHtml } from '../core/sanitize-html'
import { currencyExponent } from '@/payments/core/money'
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

export type WooPrices = {
  /** ALREADY integer minor units, as a string. "195" with minor_unit 2 is $1.95. */
  price: string
  regular_price: string
  sale_price: string
  price_range: { min_amount: string; max_amount: string } | null
  currency_code: string
  currency_minor_unit: number
}

/** An axis on a parent product: which values exist. */
export type WooParentAttribute = {
  id: number
  name: string
  has_variations: boolean
  terms: { id: number; name: string; slug: string }[]
}

/** One variation's chosen value on an axis. */
export type WooVariationAttribute = { name: string; value: string | null }

export type WooRawProduct = {
  id: number
  parent: number
  type: 'simple' | 'variable' | 'variation' | string
  name: string
  slug: string
  permalink: string
  description: string
  short_description: string
  sku: string
  prices: WooPrices
  images: { id: number; src: string; alt?: string }[]
  /**
   * Two different shapes share this field name, which is a trap.
   *
   * On a PARENT product an attribute describes an axis: `has_variations` plus
   * the `terms` available. On a VARIATION it describes that variation's chosen
   * value: just `name` and `value`. Modelling them as one shape typechecks
   * against neither, so both are declared and narrowed at each use.
   */
  attributes: (WooParentAttribute | WooVariationAttribute)[]
  variations: { id: number; attributes: { name: string; value: string | null }[] }[]
  is_in_stock: boolean
  low_stock_remaining: number | null
}

/** The API's hard maximum. 101 is a 400, not a clamp. */
const PER_PAGE = 100

/** Backstop against a store that keeps claiming another page. */
const MAX_PAGES = 100

const MANY_VARIANTS = 100

/**
 * Woo sends minor units already, so this is a validation, not a conversion.
 * Anything with a decimal point means we have misread the API contract, and
 * guessing would be worse than stopping.
 */
function minorUnitsFromString(value: string, currency: string): number {
  if (!/^-?\d+$/.test(String(value ?? '').trim())) {
    throw new Error(
      `WooCommerce returned "${value}" for a ${currency} price. The Store API sends ` +
        `integer minor units; a value with a decimal point means the response is not ` +
        `what this adapter expects.`,
    )
  }
  return Number(value)
}

/**
 * The asymmetric currency rule (spec Task 2). Woo's integers are meaningless
 * without their exponent: a KWD source (exponent 3) read into an AED store
 * (exponent 2) is wrong by a factor of ten on every price, and it looks
 * plausible. So this refuses rather than warns.
 */
function assertCurrencyUsable(prices: WooPrices, storeCurrency: string): void {
  const source = (prices?.currency_code ?? '').toUpperCase()
  const target = storeCurrency.toUpperCase()

  if (source !== target) {
    throw new Error(
      `This store prices in ${source} but your Niblr store is set to ${target}. ` +
        `Importing would copy the numbers across without converting them. ` +
        `Change your store currency to ${source} first, or import from a store that uses ${target}.`,
    )
  }

  const declared = prices.currency_minor_unit
  const expected = currencyExponent(source)
  if (declared !== expected) {
    throw new Error(
      `This store reports ${source} with ${declared} decimal places, but ${source} has ` +
        `${expected}. Refusing to import prices whose precision cannot be trusted.`,
    )
  }
}

function stockFor(raw: WooRawProduct): number | null {
  // `low_stock_remaining` is the only number the API ever gives, and only when
  // the store chose to expose it. `is_in_stock` is a boolean and cannot be
  // turned into a count without inventing one.
  return typeof raw.low_stock_remaining === 'number' ? raw.low_stock_remaining : null
}

function variantFromVariation(
  variation: WooRawProduct,
  optionNames: string[],
  storeCurrency: string,
): SourceVariant {
  assertCurrencyUsable(variation.prices, storeCurrency)

  const byName = new Map<string, string>()
  for (const attr of variation.attributes ?? []) {
    // Narrow to the variation shape; a parent-style attribute has no `value`.
    if ('value' in attr && attr.name && attr.value) byName.set(attr.name, attr.value)
  }

  return {
    externalId: String(variation.id),
    title: variation.name ?? '',
    // Index-parallel to the parent's options.
    optionValues: optionNames.map((name) => byName.get(name) ?? ''),
    priceMinor: minorUnitsFromString(variation.prices.price, storeCurrency),
    currency: storeCurrency.toUpperCase(),
    sku: variation.sku || undefined,
    inventoryQuantity: stockFor(variation),
  }
}

export function mapWooProduct(
  raw: WooRawProduct,
  variations: WooRawProduct[],
  ctx: SourceContext,
): SourceProduct {
  assertCurrencyUsable(raw.prices, ctx.storeCurrency)

  const currency = ctx.storeCurrency.toUpperCase()
  const options = (raw.attributes ?? [])
    .filter((a): a is WooParentAttribute => 'has_variations' in a && a.has_variations)
    .map((a) => ({ name: a.name, values: (a.terms ?? []).map((t) => t.name) }))
  const optionNames = options.map((o) => o.name)

  const variants: SourceVariant[] = variations.length
    ? variations.map((v) => variantFromVariation(v, optionNames, currency))
    : [
        {
          externalId: String(raw.id),
          title: raw.name,
          optionValues: [],
          priceMinor: minorUnitsFromString(raw.prices.price, currency),
          currency,
          sku: raw.sku || undefined,
          inventoryQuantity: stockFor(raw),
        },
      ]

  const images = (raw.images ?? []).map((img, index) => ({
    externalId: String(img.id),
    url: img.src,
    alt: img.alt || undefined,
    position: index + 1,
  }))

  const warnings: ImportWarning[] = []
  if (variants.every((v) => v.inventoryQuantity === null)) warnings.push('inventory_unknown')
  if (images.length === 0) warnings.push('no_images')
  if (variants.length > MANY_VARIANTS) warnings.push('many_variants')
  if (raw.type === 'variable' && (raw.variations?.length ?? 0) > 0 && variations.length === 0) {
    warnings.push('variants_unavailable')
  }

  const skus = variants.map((v) => v.sku).filter(Boolean)
  if (new Set(skus).size !== skus.length) warnings.push('duplicate_sku')

  return {
    externalId: String(raw.id),
    sourceUrl: raw.permalink,
    title: raw.name,
    descriptionHtml: sanitizeDescriptionHtml(raw.description || raw.short_description || ''),
    tags: [],
    options,
    variants,
    images,
    status: 'active',
    warnings,
  }
}

// ── Detection ────────────────────────────────────────────────────────────────

async function detect(origin: URL, safeFetch: SafeFetch): Promise<DetectResult | null> {
  // One request, and definitive: WordPress advertises its REST namespaces here.
  const response = await safeFetch(new URL('/wp-json/', origin).toString())
  if (!response.ok) return null

  try {
    const body = JSON.parse(response.body.toString('utf8')) as { namespaces?: unknown }
    const namespaces = Array.isArray(body.namespaces) ? (body.namespaces as string[]) : []
    return namespaces.includes('wc/store/v1') ? { note: 'WooCommerce store' } : null
  } catch {
    return null
  }
}

// ── Paging ───────────────────────────────────────────────────────────────────

function storeApiMissing(origin: URL, status: number | undefined): Error {
  return new Error(
    `${origin.host} did not answer on the WooCommerce Store API ` +
      `(${status ?? 'no response'}). This store is running a WooCommerce version ` +
      `without the public product API, or WooCommerce is not installed.`,
  )
}

async function* listProducts(ctx: SourceContext): AsyncIterable<SourceProduct> {
  let yielded = 0
  let totalPages: number | null = null

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
    const url = new URL('/wp-json/wc/store/v1/products', ctx.origin)
    url.searchParams.set('per_page', String(PER_PAGE))
    url.searchParams.set('page', String(pageNumber))

    const response = await ctx.fetch(url.toString())
    if (!response.ok) throw storeApiMissing(ctx.origin, response.status)

    let body: unknown
    try {
      body = JSON.parse(response.body.toString('utf8'))
    } catch {
      throw storeApiMissing(ctx.origin, response.status)
    }

    if (!Array.isArray(body)) throw storeApiMissing(ctx.origin, response.status)
    const rawProducts = body as WooRawProduct[]
    if (rawProducts.length === 0) return

    if (totalPages === null) {
      const header = response.headers.get('x-wp-totalpages')
      totalPages = header ? Number(header) : null

      // Unlike Shopify, this API says up front how much work there is. Surface
      // the variation fan-out here so the review screen can be honest about
      // duration before the merchant commits — a large variable catalog is one
      // request per variation and the per-origin gate deliberately paces them.
      const projected = rawProducts.reduce((sum, p) => sum + (p.variations?.length ?? 0), 0)
      if (projected > 0) {
        ctx.log(
          `Page 1 needs ${projected} additional variation requests. ` +
            `Variable products cost one request per variation — the Store API cannot batch them.`,
        )
      }
    }

    for (const raw of rawProducts) {
      if (yielded >= ctx.maxProducts) return

      let variations: WooRawProduct[] = []
      if (raw.type === 'variable' && (raw.variations?.length ?? 0) > 0) {
        variations = await fetchVariations(raw, ctx)
      }

      yield mapWooProduct(raw, variations, ctx)
      yielded++
    }

    // The header is authoritative when present — that is this API's advantage
    // over Shopify, which offers no total at all. The short-page heuristic is
    // only a fallback, and must not override the header: a page shorter than
    // `per_page` while the store still declares more pages would otherwise stop
    // the import early and silently.
    if (totalPages !== null) {
      if (pageNumber >= totalPages) return
    } else if (rawProducts.length < PER_PAGE) {
      return
    }
  }

  ctx.log(`Stopped after ${MAX_PAGES} pages; the remainder needs another run.`)
}

/**
 * One request per variation. `?include=` was tested against a live store and
 * returns zero results, so there is no batch form to fall back to.
 *
 * A failure here degrades the product to its parent price rather than dropping
 * it: a product with an approximate price the merchant can correct beats a
 * missing product they never learn about.
 */
async function fetchVariations(raw: WooRawProduct, ctx: SourceContext): Promise<WooRawProduct[]> {
  const out: WooRawProduct[] = []

  for (const stub of raw.variations) {
    const url = new URL(`/wp-json/wc/store/v1/products/${stub.id}`, ctx.origin)
    const response = await ctx.fetch(url.toString())
    if (!response.ok) {
      ctx.log(`Could not load variation ${stub.id} of "${raw.name}": ${response.message}`)
      return []
    }

    try {
      out.push(JSON.parse(response.body.toString('utf8')) as WooRawProduct)
    } catch {
      ctx.log(`Variation ${stub.id} of "${raw.name}" was not valid JSON`)
      return []
    }
  }

  return out
}

export const wooSource: ImportSource = {
  id: 'woocommerce',
  // Merchants say "WordPress"; the thing we detect is the WooCommerce Store
  // API. Naming both keeps the unsupported-platform message unsurprising for
  // someone whose WordPress site has no WooCommerce.
  label: 'WooCommerce (WordPress)',
  detect,
  listProducts,
}
