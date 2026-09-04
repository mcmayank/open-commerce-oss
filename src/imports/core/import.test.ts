import { describe, it, expect } from 'vitest'
import { importItem, type ImportContext } from './import'
import type { SourceProduct } from './types'

type Call = {
  collection: string
  id?: unknown
  data?: Record<string, unknown>
  where?: unknown
  op?: string
}

function fakePayload(existingProducts: Record<string, unknown>[] = [], slugTaken: string[] = []) {
  const calls: Call[] = []
  let nextId = 100
  return {
    calls,
    created: () => calls.filter((c) => c.op === 'create') as (Call & { op: string })[],
    payload: {
      find: async ({ collection, where }: Call & { where: Record<string, never> }) => {
        calls.push({ collection, where, op: 'find' } as never)
        const w = JSON.stringify(where ?? {})
        if (collection === 'products' && w.includes('externalId')) {
          return { docs: existingProducts, totalDocs: existingProducts.length }
        }
        if (collection === 'products' && w.includes('slug')) {
          const slug = (where as never as { and: { slug?: { equals: string } }[] }).and?.find(
            (c) => c.slug,
          )?.slug?.equals
          const hit = slug && slugTaken.includes(slug)
          return { docs: hit ? [{ id: 1 }] : [], totalDocs: hit ? 1 : 0 }
        }
        return { docs: [], totalDocs: 0 }
      },
      create: async ({ collection, data }: Call) => {
        calls.push({ collection, data, op: 'create' } as never)
        return { id: nextId++, ...data }
      },
      update: async ({ collection, id, data }: Call) => {
        calls.push({ collection, id, data, op: 'update' } as never)
        return { id, ...data }
      },
    },
  }
}

function mapped(overrides: Partial<SourceProduct> = {}): SourceProduct {
  return {
    externalId: 'ext-1',
    sourceUrl: 'https://shop.example/products/mug',
    title: 'Stoneware Mug',
    descriptionHtml: '<p>Nice mug.</p>',
    tags: [],
    options: [{ name: 'Size', values: ['S', 'L'] }],
    variants: [
      {
        externalId: 'v1',
        title: 'S',
        optionValues: ['S'],
        priceMinor: 2500,
        currency: 'AED',
        sku: 'MUG-S',
        inventoryQuantity: null,
      },
      {
        externalId: 'v2',
        title: 'L',
        optionValues: ['L'],
        priceMinor: 3000,
        currency: 'AED',
        sku: 'MUG-L',
        inventoryQuantity: 7,
      },
    ],
    images: [],
    status: 'active',
    warnings: [],
    ...overrides,
  }
}

function ctx(payload: unknown, overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    payload: payload as never,
    tenantId: 3,
    sourceId: 'alpha',
    sourceOrigin: 'https://shop.example',
    priceTaxTreatment: 'exclusive',
    now: () => new Date('2026-08-04T12:00:00.000Z'),
    log: () => {},
    ...overrides,
  }
}

const productWrite = (calls: Call[]) =>
  calls.find((c) => c.collection === 'products' && c.op !== 'find')

describe('importItem', () => {
  it('creates a product as a DRAFT, never published', async () => {
    const fake = fakePayload()
    await importItem({ id: 1, mapped: mapped() }, ctx(fake.payload))

    const write = productWrite(fake.calls)
    expect(write?.data?.status).toBe('draft')
  })

  it('maps title, price and description into the product', async () => {
    const fake = fakePayload()
    await importItem({ id: 1, mapped: mapped() }, ctx(fake.payload))

    const data = productWrite(fake.calls)!.data!
    expect(data.title).toBe('Stoneware Mug')
    // Product-level price comes from the first variant; the source has none.
    expect(data.price).toBe(2500)
    expect(JSON.stringify(data.description)).toContain('Nice mug.')
  })

  // SourceVariant.optionValues is index-parallel to options; the collection
  // stores { option, value } pairs. Getting this wrong silently detaches every
  // variant from its axis.
  it('pairs variant option values with their option names by index', async () => {
    const fake = fakePayload()
    await importItem({ id: 1, mapped: mapped() }, ctx(fake.payload))

    const variants = productWrite(fake.calls)!.data!.variants as {
      optionValues: { option: string; value: string }[]
      price: number
    }[]
    expect(variants).toHaveLength(2)
    expect(variants[0].optionValues).toEqual([{ option: 'Size', value: 'S' }])
    expect(variants[1].optionValues).toEqual([{ option: 'Size', value: 'L' }])
    expect(variants[1].price).toBe(3000)
  })

  // stock is required with min 0 on the collection, but "the source did not
  // say" is not "none in stock".
  it('turns unknown inventory into zero and keeps the warning visible', async () => {
    const fake = fakePayload()
    await importItem({ id: 1, mapped: mapped(), warnings: ['inventory_unknown'] }, ctx(fake.payload))

    const data = productWrite(fake.calls)!.data!
    const variants = data.variants as { stock: number }[]
    expect(variants[0].stock).toBe(0)
    expect(variants[1].stock).toBe(7)

    const itemUpdate = fake.calls.find((c) => c.collection === 'import-items')
    expect(itemUpdate?.data?.status).toBe('imported')
  })

  it('records provenance and the tax treatment the merchant declared', async () => {
    const fake = fakePayload()
    await importItem({ id: 1, mapped: mapped() }, ctx(fake.payload))

    const from = productWrite(fake.calls)!.data!.importedFrom as Record<string, unknown>
    expect(from.sourceId).toBe('alpha')
    expect(from.externalId).toBe('ext-1')
    expect(from.sourceOrigin).toBe('https://shop.example')
    expect(from.priceTaxTreatment).toBe('exclusive')
    expect(from.importedAt).toBe('2026-08-04T12:00:00.000Z')
  })

  // Re-running the same import must not double the catalog.
  it('updates the existing product instead of creating a second one', async () => {
    const fake = fakePayload([{ id: 55, title: 'Stoneware Mug' }])
    await importItem({ id: 1, mapped: mapped() }, ctx(fake.payload))

    const write = productWrite(fake.calls)!
    expect(write.op).toBe('update')
    expect(write.id).toBe(55)
    expect(fake.calls.some((c) => c.collection === 'products' && c.op === 'create')).toBe(false)
  })

  it('disambiguates a slug that another product already holds', async () => {
    const fake = fakePayload([], ['stoneware-mug'])
    await importItem({ id: 1, mapped: mapped() }, ctx(fake.payload))

    expect(productWrite(fake.calls)!.data!.slug).toBe('stoneware-mug-2')
  })

  it('records the failure on the item and does not throw', async () => {
    const payload = {
      find: async () => ({ docs: [], totalDocs: 0 }),
      create: async ({ collection }: Call) => {
        if (collection === 'products') throw new Error('price must be a whole number')
        return { id: 1 }
      },
      update: async ({ collection, id, data }: Call) => ({ collection, id, data }),
    }
    const updates: Call[] = []
    payload.update = async (call: Call) => {
      updates.push(call)
      return { id: 1 } as never
    }

    const result = await importItem({ id: 9, mapped: mapped() }, ctx(payload))

    expect(result.ok).toBe(false)
    const itemUpdate = updates.find((c) => c.collection === 'import-items')
    expect(itemUpdate?.data?.status).toBe('failed')
    expect(String(itemUpdate?.data?.error)).toContain('whole number')
  })

  it('links the created product back to the item', async () => {
    const fake = fakePayload()
    const result = await importItem({ id: 1, mapped: mapped() }, ctx(fake.payload))

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error)
    const itemUpdate = fake.calls.find((c) => c.collection === 'import-items')
    expect(itemUpdate?.data?.product).toBe(result.productId)
  })
})
