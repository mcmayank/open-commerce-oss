import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { wooSource, mapWooProduct, type WooRawProduct } from './woocommerce'
import type { SafeFetchResult } from '../core/fetch'
import type { SourceContext, SourceProduct } from '../core/types'

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf8'))

const PRODUCTS = fixture('woocommerce-products.json') as WooRawProduct[]
const VARIATION = fixture('woocommerce-variation.json') as WooRawProduct

const ORIGIN = new URL('https://barefootbuttons.com')

function ctx(overrides: Partial<SourceContext> = {}): SourceContext {
  return {
    origin: ORIGIN,
    storeCurrency: 'USD',
    fetch: async () => {
      throw new Error('no network in mapper tests')
    },
    maxProducts: 1000,
    log: () => {},
    ...overrides,
  }
}

const variable = () => PRODUCTS.find((p) => p.type === 'variable')!
const simple = () => PRODUCTS.find((p) => p.type === 'simple')!

// ── Mapping ──────────────────────────────────────────────────────────────────

describe('mapWooProduct — real fixture', () => {
  // Woo already sends integer minor units. Running them through a decimal
  // parser would multiply every price by 100.
  it('reads prices as minor units, not as a decimal amount', () => {
    const product = mapWooProduct(simple(), [], ctx())

    // The fixture's real price is the string "195", meaning $1.95.
    expect(product.variants[0].priceMinor).toBe(195)
  })

  it('maps a simple product to a single implicit variant', () => {
    const product = mapWooProduct(simple(), [], ctx())

    expect(product.variants).toHaveLength(1)
    expect(product.options).toEqual([])
    expect(product.externalId).toBe(String(simple().id))
  })

  it('builds options from the attributes that drive variations', () => {
    const product = mapWooProduct(variable(), [VARIATION], ctx())

    expect(product.options.map((o) => o.name)).toEqual(['Set Screw Size'])
    expect(product.options[0].values.length).toBeGreaterThan(0)
  })

  // The parent's `variations[]` carries ids and attribute names but no prices,
  // so a variant's real price can only come from its own fetched record.
  it('takes variant price and sku from the fetched variation, not the parent', () => {
    const product = mapWooProduct(variable(), [VARIATION], ctx())

    expect(product.variants).toHaveLength(1)
    expect(product.variants[0].externalId).toBe(String(VARIATION.id))
    expect(product.variants[0].sku).toBe(VARIATION.sku)
    expect(product.variants[0].priceMinor).toBe(Number(VARIATION.prices.price))
  })

  it('sanitises the description', () => {
    const raw = { ...simple(), description: '<p>ok</p><script>alert(1)</script>' }
    const product = mapWooProduct(raw, [], ctx())

    expect(product.descriptionHtml).toContain('ok')
    expect(product.descriptionHtml).not.toMatch(/<script/i)
  })

  it('warns rather than inventing a number when stock is only a boolean', () => {
    const product = mapWooProduct(simple(), [], ctx())

    expect(product.variants[0].inventoryQuantity).toBeNull()
    expect(product.warnings).toContain('inventory_unknown')
  })
})

// ── The currency rule ────────────────────────────────────────────────────────

describe('mapWooProduct — currency', () => {
  // A KWD source (exponent 3) read into an AED store (exponent 2) makes every
  // price wrong by a factor of ten, and the result looks plausible.
  it('refuses a source whose currency differs from the store', () => {
    expect(() => mapWooProduct(simple(), [], ctx({ storeCurrency: 'AED' }))).toThrow(/USD.*AED|AED.*USD/s)
  })

  it('refuses a feed whose declared minor unit contradicts ISO 4217', () => {
    const raw = {
      ...simple(),
      prices: { ...simple().prices, currency_code: 'USD', currency_minor_unit: 3 },
    }

    expect(() => mapWooProduct(raw, [], ctx({ storeCurrency: 'USD' }))).toThrow(/minor unit|precision/i)
  })

  it('accepts a matching three-decimal currency', () => {
    const raw = {
      ...simple(),
      prices: {
        ...simple().prices,
        price: '12000',
        currency_code: 'KWD',
        currency_minor_unit: 3,
      },
    }
    const product = mapWooProduct(raw, [], ctx({ storeCurrency: 'KWD' }))

    expect(product.variants[0].priceMinor).toBe(12000)
  })

  it('refuses a price that is not an integer string', () => {
    const raw = { ...simple(), prices: { ...simple().prices, price: '1.95' } }

    expect(() => mapWooProduct(raw, [], ctx())).toThrow(/minor units|integer/i)
  })
})

// ── Paging and the variation N+1 ─────────────────────────────────────────────

function jsonPage(body: unknown, headers: Record<string, string> = {}): SafeFetchResult {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body: Buffer.from(JSON.stringify(body)),
    url: 'https://x',
  }
}

/** Routes by URL so variation fetches can be answered individually. */
function router(handler: (url: string) => SafeFetchResult) {
  const seen: string[] = []
  return {
    seen,
    fetch: async (url: string) => {
      seen.push(url)
      return handler(url)
    },
  }
}

async function collect(it: AsyncIterable<SourceProduct>): Promise<SourceProduct[]> {
  const out: SourceProduct[] = []
  for await (const p of it) out.push(p)
  return out
}

describe('wooSource.listProducts', () => {
  it('never asks for more than the per_page maximum of 100', async () => {
    const { fetch, seen } = router(() => jsonPage([], { 'x-wp-totalpages': '1' }))

    await collect(wooSource.listProducts(ctx({ fetch })))

    // 101 is a hard 400 on this API, not a clamp, so the ceiling is exact.
    const perPage = Number(new URL(seen[0]).searchParams.get('per_page'))
    expect(perPage).toBe(100)
    expect(perPage).toBeLessThanOrEqual(100)
  })

  it('stops at the page count the response headers declare', async () => {
    const { fetch, seen } = router((url) =>
      url.includes('page=1')
        ? jsonPage([simple()], { 'x-wp-totalpages': '2' })
        : jsonPage([simple()], { 'x-wp-totalpages': '2' }),
    )

    const products = await collect(wooSource.listProducts(ctx({ fetch })))

    expect(products).toHaveLength(2)
    expect(seen.filter((u) => u.includes('/products?'))).toHaveLength(2)
  })

  it('stops on an empty page when no total header is present', async () => {
    const { fetch } = router((url) => (url.includes('page=1') ? jsonPage([simple()]) : jsonPage([])))

    const products = await collect(wooSource.listProducts(ctx({ fetch })))

    expect(products).toHaveLength(1)
  })

  // `?include=` was tested against a live store and returns zero results, so
  // each variation costs its own request. This pins the count.
  it('fetches each variation individually, since include does not batch', async () => {
    const parent = {
      ...variable(),
      variations: [
        { id: 9001, attributes: [{ name: 'Set Screw Size', value: null }] },
        { id: 9002, attributes: [{ name: 'Set Screw Size', value: null }] },
        { id: 9003, attributes: [{ name: 'Set Screw Size', value: null }] },
      ],
    }
    const { fetch, seen } = router((url) => {
      if (url.includes('/products?')) {
        return url.includes('page=1') ? jsonPage([parent], { 'x-wp-totalpages': '1' }) : jsonPage([])
      }
      const id = Number(url.split('/').pop())
      return jsonPage({ ...VARIATION, id, sku: `SKU-${id}` })
    })

    const products = await collect(wooSource.listProducts(ctx({ fetch })))

    expect(products[0].variants).toHaveLength(3)
    expect(products[0].variants.map((v) => v.sku)).toEqual(['SKU-9001', 'SKU-9002', 'SKU-9003'])
    const variationCalls = seen.filter((u) => /\/products\/\d+$/.test(u))
    expect(variationCalls).toHaveLength(3)
    expect(seen.some((u) => u.includes('include='))).toBe(false)
  })

  it('warns and keeps the product when its variations cannot be fetched', async () => {
    const parent = {
      ...variable(),
      variations: [{ id: 9001, attributes: [{ name: 'Set Screw Size', value: null }] }],
    }
    const { fetch } = router((url) => {
      if (url.includes('/products?')) {
        return url.includes('page=1') ? jsonPage([parent], { 'x-wp-totalpages': '1' }) : jsonPage([])
      }
      return { ok: false, reason: 'HTTP_ERROR', status: 404, message: 'gone' }
    })

    const products = await collect(wooSource.listProducts(ctx({ fetch })))

    expect(products).toHaveLength(1)
    expect(products[0].warnings).toContain('variants_unavailable')
    // Degrades to a single priced variant rather than dropping the product.
    expect(products[0].variants).toHaveLength(1)
  })

  it('reports projected variation requests so the review screen can warn', async () => {
    const logs: string[] = []
    const parent = {
      ...variable(),
      variations: Array.from({ length: 5 }, (_, i) => ({
        id: 9000 + i,
        attributes: [{ name: 'Set Screw Size', value: null }],
      })),
    }
    const { fetch } = router((url) => {
      if (url.includes('/products?')) {
        return url.includes('page=1') ? jsonPage([parent], { 'x-wp-totalpages': '1' }) : jsonPage([])
      }
      const id = Number(url.split('/').pop())
      return jsonPage({ ...VARIATION, id })
    })

    await collect(wooSource.listProducts(ctx({ fetch, log: (m) => logs.push(m) })))

    expect(logs.join('\n')).toMatch(/variation/i)
  })

  it('explains a store with no Store API rather than throwing a parse error', async () => {
    const { fetch } = router(() => ({
      ok: false,
      reason: 'HTTP_ERROR',
      status: 404,
      message: 'not found',
    }))

    await expect(collect(wooSource.listProducts(ctx({ fetch })))).rejects.toThrow(
      /public product API|Store API/i,
    )
  })
})

describe('wooSource.detect', () => {
  it('recognises a store advertising the wc/store/v1 namespace', async () => {
    const detected = await wooSource.detect(ORIGIN, async () =>
      jsonPage({ namespaces: ['wp/v2', 'wc/store/v1'] }),
    )

    expect(detected).not.toBeNull()
  })

  it('returns null for WordPress without WooCommerce', async () => {
    const detected = await wooSource.detect(ORIGIN, async () => jsonPage({ namespaces: ['wp/v2'] }))

    expect(detected).toBeNull()
  })
})
