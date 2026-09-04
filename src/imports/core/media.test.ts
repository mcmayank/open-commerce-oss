import { vi, describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { ingestImages, createImageBudget, type MediaContext } from './media'
import type { SafeFetchResult } from './fetch'
import type { SourceImage } from './types'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

type Created = { collection: string; data: Record<string, unknown>; file?: unknown }

/**
 * @param existing rows already in `media`, as { contentHash, id, tenant }
 */
function fakePayload(existing: { contentHash: string; id: number; tenant?: number }[] = []) {
  const created: Created[] = []
  const finds: Record<string, unknown>[] = []
  let nextId = 500
  return {
    created,
    finds,
    payload: {
      find: async ({ where }: { where: Record<string, unknown> }) => {
        finds.push(where)
        const clauses = (where?.and ?? []) as Record<string, { equals?: unknown }>[]
        const hash = clauses.find((c) => c.contentHash)?.contentHash?.equals
        const tenant = clauses.find((c) => c.tenant)?.tenant?.equals
        const hit = existing.find(
          (e) => e.contentHash === hash && (e.tenant ?? 3) === tenant,
        )
        return { docs: hit ? [{ id: hit.id }] : [], totalDocs: hit ? 1 : 0 }
      },
      create: async ({ collection, data, file }: Created) => {
        created.push({ collection, data, file })
        return { id: nextId++ }
      },
    } as never,
  }
}

/** The sha256 the ingest will compute for these bytes. */
const hashOf = (content: string) =>
  createHash('sha256').update(Buffer.from(content)).digest('hex')

const bytes = (content: string, type = 'image/jpeg'): SafeFetchResult => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': type }),
  body: Buffer.from(content),
  url: 'https://cdn.example/a.jpg',
})

function image(overrides: Partial<SourceImage> = {}): SourceImage {
  return { externalId: 'i1', url: 'https://cdn.example/a.jpg', position: 1, ...overrides }
}

function ctx(payload: unknown, overrides: Partial<MediaContext> = {}): MediaContext {
  return {
    payload: payload as never,
    tenantId: 3,
    fetch: async () => bytes('AAAA'),
    log: () => {},
    seen: new Map(),
    budget: createImageBudget(10_000_000),
    ...overrides,
  }
}

describe('ingestImages', () => {
  it('uploads through Payload with the File shape the Local API expects', async () => {
    const fake = fakePayload()
    const result = await ingestImages([image()], 'Blue Mug', ctx(fake.payload))

    expect(result.mediaIds).toHaveLength(1)
    const call = fake.created[0]
    expect(call.collection).toBe('media')

    // Payload's own File type — a Buffer plus metadata, NOT a Web File. Going
    // through create() is what makes sharp, imageSizes and the quota hooks run.
    const file = call.file as { data: Buffer; mimetype: string; name: string; size: number }
    expect(Buffer.isBuffer(file.data)).toBe(true)
    expect(file.mimetype).toBe('image/jpeg')
    expect(file.size).toBe(file.data.length)
    expect(file.name).toMatch(/\.jpg$/)
  })

  it('sets alt text from the source, falling back to the product title', async () => {
    const fake = fakePayload()
    await ingestImages([image({ alt: 'A blue mug' })], 'Blue Mug', ctx(fake.payload))
    expect(fake.created[0].data.alt).toBe('A blue mug')

    const second = fakePayload()
    await ingestImages([image()], 'Blue Mug', ctx(second.payload))
    expect(second.created[0].data.alt).toBe('Blue Mug')
  })

  // Product image reuse across variants is constant on real stores. Uploading
  // the same bytes four times costs four uploads, four sharp runs and four
  // copies of every generated size.
  it('uploads identical bytes once and reuses the media document', async () => {
    const fake = fakePayload()
    const context = ctx(fake.payload)

    const first = await ingestImages([image({ externalId: 'a' })], 'Mug', context)
    const second = await ingestImages(
      [image({ externalId: 'b', url: 'https://cdn.example/different-url.jpg' })],
      'Mug',
      context,
    )

    expect(fake.created).toHaveLength(1)
    expect(second.mediaIds).toEqual(first.mediaIds)
  })

  it('treats different bytes as different images', async () => {
    const fake = fakePayload()
    let call = 0
    const context = ctx(fake.payload, {
      fetch: async () => bytes(call++ === 0 ? 'AAAA' : 'BBBB'),
    })

    await ingestImages([image({ externalId: 'a' }), image({ externalId: 'b' })], 'Mug', context)

    expect(fake.created).toHaveLength(2)
  })

  // The Media allowlist is jpeg/png/webp/avif/gif. An SVG would throw inside
  // payload.create; catching it beforehand keeps the message useful.
  it('skips a type the media collection will not accept, without failing', async () => {
    const fake = fakePayload()
    const result = await ingestImages(
      [image()],
      'Mug',
      ctx(fake.payload, { fetch: async () => bytes('<svg/>', 'image/svg+xml') }),
    )

    expect(fake.created).toHaveLength(0)
    expect(result.mediaIds).toEqual([])
    expect(result.skipped).toBe(1)
  })

  // Five, not ten: at ~540 KB per stored image, 50 products x 10 would exceed
  // Free's 250 MB before the 50-product cap was reached.
  it('caps how many images one product contributes', async () => {
    const fake = fakePayload()
    let n = 0
    const many = Array.from({ length: 20 }, (_, i) => image({ externalId: `i${i}` }))

    const result = await ingestImages(
      many,
      'Mug',
      ctx(fake.payload, { fetch: async () => bytes(`unique-${n++}`) }),
    )

    expect(fake.created).toHaveLength(5)
    expect(result.mediaIds).toHaveLength(5)
    expect(result.truncated).toBe(true)
  })

  it('stops once the job byte budget is spent, and says so', async () => {
    const fake = fakePayload()
    let n = 0
    const context = ctx(fake.payload, {
      budget: createImageBudget(10),
      fetch: async () => bytes(`abcde-${n++}`),
    })

    const result = await ingestImages(
      [image({ externalId: 'a' }), image({ externalId: 'b' }), image({ externalId: 'c' })],
      'Mug',
      context,
    )

    expect(fake.created.length).toBeLessThan(3)
    expect(result.budgetExhausted).toBe(true)
  })

  // A product with no pictures beats no product at all.
  it('keeps going when one image fails to download', async () => {
    const fake = fakePayload()
    let call = 0
    const context = ctx(fake.payload, {
      fetch: async () =>
        call++ === 0
          ? ({ ok: false, reason: 'NETWORK', message: 'boom' } as SafeFetchResult)
          : bytes('BBBB'),
    })

    const result = await ingestImages(
      [image({ externalId: 'a' }), image({ externalId: 'b' })],
      'Mug',
      context,
    )

    expect(result.mediaIds).toHaveLength(1)
    expect(result.skipped).toBe(1)
  })

  it('keeps going when an upload is rejected by the collection', async () => {
    const payload = {
      create: async () => {
        throw new Error('mime type not allowed')
      },
    }
    const result = await ingestImages([image()], 'Mug', ctx(payload))

    expect(result.mediaIds).toEqual([])
    expect(result.skipped).toBe(1)
  })

  it('reports a storage-quota refusal separately, so the run can stop ingesting', async () => {
    const payload = {
      create: async () => {
        throw new Error('Your Free plan is limited to 250 MB of storage.')
      },
    }
    const result = await ingestImages([image()], 'Mug', ctx(payload))

    expect(result.quotaExhausted).toBe(true)
  })
})

// ── Durable dedupe ───────────────────────────────────────────────────────────

describe('ingestImages — content-hash dedupe across runs', () => {
  it('stores the hash so a later run can find the same bytes', async () => {
    const fake = fakePayload()

    await ingestImages([image()], 'Mug', ctx(fake.payload, { fetch: async () => bytes('same') }))

    const data = fake.created[0].data as { contentHash?: string }
    expect(data.contentHash).toBe(hashOf('same'))
  })

  // The bug this fixes: re-importing a catalog updated every product and
  // re-uploaded every image, doubling storage on each run.
  it('reuses an existing document instead of uploading identical bytes again', async () => {
    const fake = fakePayload([{ contentHash: hashOf('same'), id: 42, tenant: 3 }])

    const result = await ingestImages(
      [image()],
      'Mug',
      ctx(fake.payload, { fetch: async () => bytes('same') }),
    )

    expect(fake.created).toHaveLength(0)
    expect(result.mediaIds).toEqual([42])
    expect(result.reused).toBe(1)
  })

  it('still uploads when the bytes differ', async () => {
    const fake = fakePayload([{ contentHash: hashOf('other'), id: 42, tenant: 3 }])

    const result = await ingestImages(
      [image()],
      'Mug',
      ctx(fake.payload, { fetch: async () => bytes('same') }),
    )

    expect(fake.created).toHaveLength(1)
    expect(result.reused).toBe(0)
  })

  // A hash is global but media is not. Reusing another store's document would
  // hand one tenant a file belonging to another.
  it('never reuses a document belonging to a different tenant', async () => {
    const fake = fakePayload([{ contentHash: hashOf('same'), id: 42, tenant: 999 }])

    const result = await ingestImages(
      [image()],
      'Mug',
      ctx(fake.payload, { fetch: async () => bytes('same') }),
    )

    expect(fake.created).toHaveLength(1)
    expect(result.mediaIds).not.toContain(42)
  })

  it('does not re-query for bytes it uploaded moments ago', async () => {
    const fake = fakePayload()

    await ingestImages(
      [image({ externalId: 'a' }), image({ externalId: 'b' })],
      'Mug',
      ctx(fake.payload, { fetch: async () => bytes('same') }),
    )

    expect(fake.created).toHaveLength(1)
    // One lookup for the first image; the second is served from the cache.
    expect(fake.finds).toHaveLength(1)
  })

  it('uploads rather than failing when the lookup errors', async () => {
    const fake = fakePayload()
    const payload = {
      ...(fake.payload as unknown as Record<string, unknown>),
      find: async () => {
        throw new Error('database unavailable')
      },
    }

    const result = await ingestImages(
      [image()],
      'Mug',
      ctx(payload as never, { fetch: async () => bytes('same') }),
    )

    expect(result.mediaIds).toHaveLength(1)
  })
})
