import { describe, it, expect } from 'vitest'
import { runDiscovery, normalizeToOrigin, describeBoilerplate } from './discover'
import { createSourceRegistry, sourceRegistry } from './source-registry'
import type { ImportSource, SourceProduct } from './types'
import type { SafeFetchResult } from './fetch'

// ── Fakes ────────────────────────────────────────────────────────────────────

type Created = { collection: string; data: Record<string, unknown> }
type Updated = { collection: string; id: string | number; data: Record<string, unknown> }

function fakePayload() {
  const created: Created[] = []
  const updated: Updated[] = []
  let nextId = 1
  return {
    created,
    updated,
    payload: {
      create: async ({ collection, data }: Created) => {
        created.push({ collection, data })
        return { id: nextId++, ...data }
      },
      update: async ({ collection, id, data }: Updated) => {
        updated.push({ collection, id, data })
        return { id, ...data }
      },
    },
  }
}

function product(overrides: Partial<SourceProduct> = {}): SourceProduct {
  return {
    externalId: 'p1',
    sourceUrl: 'https://shop.example/products/p1',
    title: 'A product',
    descriptionHtml: '<p>A nice thing.</p>',
    tags: [],
    options: [],
    variants: [
      {
        externalId: 'v1',
        title: 'Default',
        optionValues: [],
        priceMinor: 1000,
        currency: 'AED',
        sku: 'SKU-1',
      },
    ],
    images: [{ externalId: 'i1', url: 'https://cdn.example/a.jpg', position: 1 }],
    status: 'active',
    warnings: [],
    ...overrides,
  }
}

function fakeSource(id: string, products: SourceProduct[], detects = true): ImportSource {
  return {
    id,
    label: id,
    detect: async () => (detects ? { note: `${id} store` } : null),
    listProducts: async function* () {
      for (const p of products) yield p
    },
  }
}

const noFetch = async (): Promise<SafeFetchResult> => ({
  ok: false,
  reason: 'NETWORK',
  message: 'not used',
})

const JOB = { id: 7, sourceUrl: 'https://shop.example', storeId: 3 }

function args(overrides: Partial<Parameters<typeof runDiscovery>[0]> = {}) {
  const { payload } = fakePayload()
  return {
    job: JOB,
    storeCurrency: 'AED',
    maxProducts: 100,
    registry: createSourceRegistry([fakeSource('alpha', [product()])]),
    payload: payload as never,
    fetch: noFetch,
    log: () => {},
    ...overrides,
  }
}

// ── URL normalisation ────────────────────────────────────────────────────────

describe('normalizeToOrigin', () => {
  it('reduces a pasted storefront URL to its origin', () => {
    expect(normalizeToOrigin('https://shop.example/collections/all?page=2')?.toString()).toBe(
      'https://shop.example/',
    )
  })

  it('accepts a bare host and assumes https', () => {
    expect(normalizeToOrigin('shop.example')?.toString()).toBe('https://shop.example/')
  })

  it('returns null for something that is not an address', () => {
    expect(normalizeToOrigin('')).toBeNull()
    expect(normalizeToOrigin('not a url at all')).toBeNull()
  })
})

// ── Detection ────────────────────────────────────────────────────────────────

describe('runDiscovery — detection', () => {
  it('records which adapter matched and marks the job ready', async () => {
    const fake = fakePayload()
    const result = await runDiscovery(args({ payload: fake.payload as never }))

    expect(result.sourceId).toBe('alpha')
    expect(result.detectedProductCount).toBe(1)

    const final = fake.updated.at(-1)
    expect(final?.collection).toBe('import-jobs')
    expect(final?.data.status).toBe('ready')
    expect(final?.data.detectedProductCount).toBe(1)
    expect(final?.data.sourceId).toBe('alpha')
  })

  it('takes the first adapter that detects, and does not run the others', async () => {
    let secondRan = false
    const second: ImportSource = {
      id: 'beta',
      label: 'beta',
      detect: async () => ({ note: 'beta' }),
      listProducts: async function* () {
        secondRan = true
      },
    }
    const registry = createSourceRegistry([fakeSource('alpha', [product()]), second])

    const result = await runDiscovery(args({ registry }))

    expect(result.sourceId).toBe('alpha')
    expect(secondRan).toBe(false)
  })

  it('fails the job and says plainly that nothing else is supported', async () => {
    const fake = fakePayload()
    const registry = createSourceRegistry([fakeSource('alpha', [], false)])

    await expect(
      runDiscovery(args({ registry, payload: fake.payload as never })),
    ).rejects.toThrow(/not supported/i)

    const final = fake.updated.at(-1)
    expect(final?.data.status).toBe('failed')
    expect(String(final?.data.error)).toMatch(/not supported/i)
  })

  // The message must name the real platforms, and must do so by reading the
  // registry — hardcoding "Shopify and WooCommerce" into copy is exactly what
  // goes stale the next time an adapter ships.
  it('names the platforms that are actually registered', async () => {
    const fake = fakePayload()
    const undetectable = sourceRegistry.list().map((s) => ({
      ...s,
      detect: async () => null,
    }))

    await expect(
      runDiscovery(
        args({
          registry: createSourceRegistry(undetectable),
          payload: fake.payload as never,
        }),
      ),
    ).rejects.toThrow(/Shopify and WooCommerce/i)
  })

  it('fails the job with the adapter message when listing throws', async () => {
    const fake = fakePayload()
    const angry: ImportSource = {
      id: 'alpha',
      label: 'alpha',
      detect: async () => ({ note: 'alpha' }),
      listProducts: async function* () {
        throw new Error('This store prices in KWD but your Niblr store is set to AED.')
      },
    }

    await expect(
      runDiscovery(
        args({ registry: createSourceRegistry([angry]), payload: fake.payload as never }),
      ),
    ).rejects.toThrow(/KWD/)

    const final = fake.updated.at(-1)
    expect(final?.data.status).toBe('failed')
    expect(String(final?.data.error)).toContain('KWD')
  })
})

// ── Writing items ────────────────────────────────────────────────────────────

describe('runDiscovery — items', () => {
  it('writes one item per product, carrying raw and mapped', async () => {
    const fake = fakePayload()
    await runDiscovery(args({ payload: fake.payload as never }))

    const items = fake.created.filter((c) => c.collection === 'import-items')
    expect(items).toHaveLength(1)
    expect(items[0].data.externalId).toBe('p1')
    expect(items[0].data.status).toBe('pending')
    expect(items[0].data.job).toBe(JOB.id)
    expect(items[0].data.mapped).toBeTruthy()
  })

  // Discovery must move no image bytes. The review grid points at the source
  // CDN; nothing is downloaded until a merchant presses import.
  it('creates no media documents', async () => {
    const fake = fakePayload()
    await runDiscovery(args({ payload: fake.payload as never }))

    expect(fake.created.some((c) => c.collection === 'media')).toBe(false)
    const item = fake.created.find((c) => c.collection === 'import-items')!
    const mapped = item.data.mapped as SourceProduct
    expect(mapped.images[0].url).toBe('https://cdn.example/a.jpg')
  })

  it('stops at the ceiling it is given', async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      product({ externalId: `p${i}`, variants: [] }),
    )
    const fake = fakePayload()

    const result = await runDiscovery(
      args({
        registry: createSourceRegistry([fakeSource('alpha', many)]),
        maxProducts: 4,
        payload: fake.payload as never,
      }),
    )

    expect(result.detectedProductCount).toBe(4)
    expect(fake.created.filter((c) => c.collection === 'import-items')).toHaveLength(4)
  })

  it('flags a SKU reused across two different products', async () => {
    const fake = fakePayload()
    const a = product({ externalId: 'a' })
    const b = product({ externalId: 'b' })
    await runDiscovery(
      args({
        registry: createSourceRegistry([fakeSource('alpha', [a, b])]),
        payload: fake.payload as never,
      }),
    )

    const items = fake.created.filter((c) => c.collection === 'import-items')
    expect(items[0].data.warnings).not.toContain('duplicate_sku')
    expect(items[1].data.warnings).toContain('duplicate_sku')
  })

  it('keeps the warnings the adapter already raised', async () => {
    const fake = fakePayload()
    await runDiscovery(
      args({
        registry: createSourceRegistry([
          fakeSource('alpha', [product({ warnings: ['inventory_unknown'] })]),
        ]),
        payload: fake.payload as never,
      }),
    )

    const item = fake.created.find((c) => c.collection === 'import-items')!
    expect(item.data.warnings).toContain('inventory_unknown')
  })
})

// ── Boilerplate detection ────────────────────────────────────────────────────

describe('describeBoilerplate', () => {
  it('flags descriptions that are really shipping and returns furniture', () => {
    expect(describeBoilerplate('<p>Free shipping on all orders. 30 day returns.</p>')).toBe(true)
    expect(describeBoilerplate('Add to cart now! Size chart below.')).toBe(true)
  })

  it('leaves a real product description alone', () => {
    expect(
      describeBoilerplate('<p>Hand-thrown stoneware mug, 300ml, dishwasher safe.</p>'),
    ).toBe(false)
  })

  it('treats an empty description as nothing to flag', () => {
    expect(describeBoilerplate('')).toBe(false)
    expect(describeBoilerplate('   ')).toBe(false)
  })

  it('is attached to the item during discovery', async () => {
    const fake = fakePayload()
    await runDiscovery(
      args({
        registry: createSourceRegistry([
          fakeSource('alpha', [
            product({ descriptionHtml: '<p>Free shipping on all orders.</p>' }),
          ]),
        ]),
        payload: fake.payload as never,
      }),
    )

    const item = fake.created.find((c) => c.collection === 'import-items')!
    expect(item.data.warnings).toContain('boilerplate_description')
  })
})
