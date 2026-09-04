import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { shopifySource, mapShopifyProduct, type ShopifyRawProduct } from './shopify'
import type { SafeFetchResult } from '../core/fetch'
import type { SourceContext, SourceProduct } from '../core/types'

const FIXTURE = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'shopify-products.json'), 'utf8'),
) as { products: ShopifyRawProduct[] }

const ORIGIN = new URL('https://www.blenderbottle.com')

function ctx(overrides: Partial<SourceContext> = {}): SourceContext {
  return {
    origin: ORIGIN,
    storeCurrency: 'AED',
    fetch: async () => {
      throw new Error('no network in mapper tests')
    },
    maxProducts: 1000,
    log: () => {},
    ...overrides,
  }
}

const byHandle = (handle: string): ShopifyRawProduct => {
  const found = FIXTURE.products.find((p) => p.handle === handle)
  if (!found) throw new Error(`fixture missing ${handle}`)
  return found
}

// ── Mapping, against the committed real capture ──────────────────────────────

describe('mapShopifyProduct — real fixture', () => {
  it('maps a two-axis product so each variant knows both of its option values', () => {
    const product = mapShopifyProduct(byHandle('classic'), ctx())

    expect(product.options.map((o) => o.name)).toEqual(['Size', 'Color'])
    // optionValues is index-parallel to options: [size, colour].
    for (const variant of product.variants) {
      expect(variant.optionValues).toHaveLength(2)
      expect(product.options[0].values).toContain(variant.optionValues[0])
      expect(product.options[1].values).toContain(variant.optionValues[1])
    }
    // The fixture deliberately varies BOTH axes.
    expect(new Set(product.variants.map((v) => v.optionValues[0])).size).toBeGreaterThan(1)
    expect(new Set(product.variants.map((v) => v.optionValues[1])).size).toBeGreaterThan(1)
  })

  it('maps a single-variant product', () => {
    const product = mapShopifyProduct(byHandle('one-small-step-pro-series'), ctx())

    expect(product.variants).toHaveLength(1)
    expect(product.variants[0].optionValues).toEqual(['28 OZ'])
    expect(product.variants[0].sku).toBe('C07455W')
  })

  it('converts decimal price strings to integer minor units', () => {
    const product = mapShopifyProduct(byHandle('one-small-step-pro-series'), ctx())

    // The fixture's real price is "14.99".
    expect(product.variants[0].priceMinor).toBe(1499)
    expect(Number.isInteger(product.variants[0].priceMinor)).toBe(true)
  })

  // The reason parseMinorExact exists: the same feed read into a three-decimal
  // store must not be off by a factor of ten.
  it('respects the target store exponent for a three-decimal currency', () => {
    const product = mapShopifyProduct(byHandle('one-small-step-pro-series'), ctx({ storeCurrency: 'KWD' }))

    expect(product.variants[0].priceMinor).toBe(14990)
  })

  it('carries product identity and a source URL', () => {
    const raw = byHandle('classic')
    const product = mapShopifyProduct(raw, ctx())

    expect(product.externalId).toBe(String(raw.id))
    expect(product.sourceUrl).toBe('https://www.blenderbottle.com/products/classic')
    expect(product.title).toBe(raw.title)
  })

  it('requests a bounded image width rather than the untouched master', () => {
    const product = mapShopifyProduct(byHandle('classic'), ctx())

    expect(product.images.length).toBeGreaterThan(0)
    for (const image of product.images) {
      expect(image.url).toContain('width=2000')
      // The cache-buster the CDN already put there must survive.
      expect(image.url).toMatch(/[?&]v=/)
    }
  })

  // Shopify's public feed carries no inventory at all. Mapping that to 0 would
  // silently tell a merchant their whole catalog is out of stock.
  it('reports unknown inventory as null and warns, never as zero', () => {
    const product = mapShopifyProduct(byHandle('classic'), ctx())

    for (const variant of product.variants) {
      expect(variant.inventoryQuantity).toBeNull()
    }
    expect(product.warnings).toContain('inventory_unknown')
  })
})

// ── Cases absent from real data, built inline ────────────────────────────────

function rawProduct(overrides: Partial<ShopifyRawProduct> = {}): ShopifyRawProduct {
  return {
    id: 1,
    handle: 'test-product',
    title: 'Test product',
    body_html: '<p>Fine.</p>',
    vendor: 'Acme',
    product_type: 'Bottle',
    tags: ['a', 'b'],
    options: [{ name: 'Size', values: ['S'] }],
    variants: [
      {
        id: 11,
        title: 'S',
        option1: 'S',
        option2: null,
        option3: null,
        price: '10.00',
        compare_at_price: null,
        sku: 'SKU1',
        grams: 100,
      },
    ],
    images: [{ id: 21, src: 'https://cdn.shopify.com/s/files/1/1/files/a.jpg?v=1', position: 1 }],
    ...overrides,
  } as ShopifyRawProduct
}

describe('mapShopifyProduct — edge cases', () => {
  it('sanitises description HTML before it leaves the adapter', () => {
    const product = mapShopifyProduct(
      rawProduct({
        body_html: '<p>Good</p><script>alert(1)</script><img src=x onerror="alert(2)">',
      }),
      ctx(),
    )

    expect(product.descriptionHtml).toContain('Good')
    expect(product.descriptionHtml).not.toMatch(/<script/i)
    expect(product.descriptionHtml).not.toMatch(/\bon\w+\s*=/i)
    expect(product.descriptionHtml).not.toContain('alert(1)')
  })

  it('flags a product with no images', () => {
    const product = mapShopifyProduct(rawProduct({ images: [] }), ctx())

    expect(product.images).toEqual([])
    expect(product.warnings).toContain('no_images')
  })

  it('flags a product whose variants carry no usable price', () => {
    const product = mapShopifyProduct(
      rawProduct({ variants: [{ ...rawProduct().variants[0], price: null as unknown as string }] }),
      ctx(),
    )

    expect(product.warnings).toContain('no_price')
  })

  it('flags a product with an unwieldy number of variants', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({
      ...rawProduct().variants[0],
      id: i,
      option1: `V${i}`,
    }))
    const product = mapShopifyProduct(rawProduct({ variants: many }), ctx())

    expect(product.warnings).toContain('many_variants')
  })

  it('carries compare_at_price when the source sets one', () => {
    const product = mapShopifyProduct(
      rawProduct({ variants: [{ ...rawProduct().variants[0], compare_at_price: '15.00' }] }),
      ctx(),
    )

    expect(product.variants[0].compareAtMinor).toBe(1500)
  })
})

// ── Paging ───────────────────────────────────────────────────────────────────

function page(products: unknown[]): SafeFetchResult {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    body: Buffer.from(JSON.stringify({ products })),
    url: 'https://x/products.json',
  }
}

function rawPage(json: string): SafeFetchResult {
  return { ok: true, status: 200, headers: new Headers(), body: Buffer.from(json), url: 'https://x' }
}

/** A fetch that replays scripted pages and records the URLs asked for. */
function pager(...results: SafeFetchResult[]) {
  const seen: string[] = []
  let i = 0
  const fetch = async (url: string): Promise<SafeFetchResult> => {
    seen.push(url)
    return results[i++] ?? page([])
  }
  return { fetch, seen }
}

async function collect(source: AsyncIterable<SourceProduct>): Promise<SourceProduct[]> {
  const out: SourceProduct[] = []
  for await (const p of source) out.push(p)
  return out
}

describe('shopifySource.listProducts — paging', () => {
  const full = () => Array.from({ length: 250 }, (_, i) => rawProduct({ id: i, handle: `p${i}` }))

  it('stops on a short page', async () => {
    const { fetch, seen } = pager(page(full()), page([rawProduct()]))

    const products = await collect(shopifySource.listProducts(ctx({ fetch })))

    expect(products).toHaveLength(251)
    expect(seen).toHaveLength(2)
    expect(seen[0]).toContain('limit=250&page=1')
    expect(seen[1]).toContain('page=2')
  })

  it('stops on an empty page', async () => {
    const { fetch, seen } = pager(page(full()), page([]))

    const products = await collect(shopifySource.listProducts(ctx({ fetch })))

    expect(products).toHaveLength(250)
    expect(seen).toHaveLength(2)
  })

  // The 25 000 wall returns HTTP 200 with an `errors` key and NO products key,
  // so `body.products.length` throws rather than terminating the loop.
  it('stops on the 25000-product wall, which arrives as a 200', async () => {
    const { fetch, seen } = pager(
      page(full()),
      rawPage(JSON.stringify({ errors: 'Page * Limit exceeds the 25000 limit.' })),
    )

    const products = await collect(shopifySource.listProducts(ctx({ fetch })))

    expect(products).toHaveLength(250)
    expect(seen).toHaveLength(2)
  })

  it('stops once the caller ceiling is reached', async () => {
    const { fetch } = pager(page(full()), page(full()))

    const products = await collect(shopifySource.listProducts(ctx({ fetch, maxProducts: 10 })))

    expect(products).toHaveLength(10)
  })

  it('explains a feed that is switched off rather than throwing a parse error', async () => {
    const fetch = async (): Promise<SafeFetchResult> => ({
      ok: false,
      reason: 'HTTP_ERROR',
      status: 404,
      message: 'not found',
    })

    await expect(collect(shopifySource.listProducts(ctx({ fetch })))).rejects.toThrow(
      /public product feed/i,
    )
  })

  it('explains a response that is not a Shopify feed at all', async () => {
    const { fetch } = pager(rawPage('<!doctype html><html>hello</html>'))

    await expect(collect(shopifySource.listProducts(ctx({ fetch })))).rejects.toThrow(
      /did not return a Shopify product feed/i,
    )
  })
})

describe('shopifySource.detect', () => {
  it('recognises a store from the x-shopid header', async () => {
    const detected = await shopifySource.detect(ORIGIN, async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-shopid': '12345' }),
      body: Buffer.from(''),
      url: ORIGIN.toString(),
    }))

    expect(detected).not.toBeNull()
  })

  it('returns null for a site that is not Shopify', async () => {
    const detected = await shopifySource.detect(ORIGIN, async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: Buffer.from('<html>a WordPress site</html>'),
      url: ORIGIN.toString(),
    }))

    expect(detected).toBeNull()
  })
})
