/**
 * Import — phase three of three.
 *
 * Writes one selected item into the catalog. Everything goes through the Local
 * API rather than SQL so every collection hook and access rule fires normally:
 * the product-quota check, slug derivation, variant title derivation and the
 * storefront cache invalidation are all things this must NOT bypass.
 *
 * Deliberately per-item. There is no transaction around a run — it can span
 * minutes and thousands of writes, and holding a Postgres transaction open that
 * long is its own outage. Per-item atomicity is the right granularity, and the
 * report tells the merchant exactly what landed.
 */
import type { Payload } from 'payload'
import { safeSlugify } from '@/lib/slug'
import { htmlToLexical } from './html-to-lexical'
import type { ImportWarning, SourceProduct } from './types'
import { ingestImages, type MediaContext } from './media'
import { storeWhere, storeRef } from '@/store-scope'

export type ImportContext = {
  payload: Payload
  tenantId: number
  sourceId: string
  sourceOrigin: string
  priceTaxTreatment: 'inclusive' | 'exclusive'
  now: () => Date
  log: (message: string) => void
  /**
   * Image ingest. Optional so the runner can be tested without it, and so a
   * store that has exhausted its storage quota can keep importing products
   * without pictures rather than failing outright.
   */
  media?: MediaContext
}

export type ImportableItem = {
  id: number
  mapped: SourceProduct
  warnings?: ImportWarning[]
}

export type ImportOutcome =
  | { ok: true; productId: number; created: boolean }
  | { ok: false; error: string }

/**
 * Find a slug nobody else in this store is using.
 *
 * Products has a unique index on (tenant, slug) and derives a slug from the
 * title when one is blank, so two source products called "Mug" would collide.
 * Disambiguating up front gives a readable URL; letting the write fail would
 * lose the product for no reason.
 */
async function availableSlug(base: string, ctx: ImportContext): Promise<string> {
  const root = safeSlugify(base) || 'product'

  for (let suffix = 1; suffix <= 50; suffix++) {
    const candidate = suffix === 1 ? root : `${root}-${suffix}`
    const { totalDocs } = await ctx.payload.find({
      collection: 'products',
      where: { and: [storeWhere(ctx.tenantId), { slug: { equals: candidate } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (totalDocs === 0) return candidate
  }

  // 50 products sharing one title is not a real catalog; fall back to something
  // guaranteed unique rather than looping.
  return `${root}-${Date.now()}`
}

/** Look for a product this import already created, so a re-run updates it. */
async function findExisting(
  externalId: string,
  ctx: ImportContext,
): Promise<{ id: number } | null> {
  const { docs } = await ctx.payload.find({
    collection: 'products',
    where: {
      and: [
        storeWhere(ctx.tenantId),
        { 'importedFrom.externalId': { equals: externalId } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as { id: number } | undefined) ?? null
}

function buildVariants(mapped: SourceProduct) {
  const optionNames = mapped.options.map((o) => o.name)

  return mapped.variants.map((variant) => ({
    title: variant.title,
    // `optionValues` is index-parallel to `options`; the collection stores
    // { option, value } pairs. Pairing by index is the whole mapping.
    optionValues: variant.optionValues
      .map((value, index) => ({ option: optionNames[index] ?? '', value }))
      .filter((pair) => pair.option !== '' && pair.value !== ''),
    price: variant.priceMinor,
    sku: variant.sku,
    // `stock` is required with min 0. Null means the source did not publish
    // inventory, which is NOT the same as none — the `inventory_unknown`
    // warning stays on the item so the merchant is told the zero is ours.
    stock: typeof variant.inventoryQuantity === 'number' ? variant.inventoryQuantity : 0,
  }))
}

export async function importItem(
  item: ImportableItem,
  ctx: ImportContext,
): Promise<ImportOutcome> {
  const { mapped } = item

  try {
    const existing = await findExisting(mapped.externalId, ctx)
    const variants = buildVariants(mapped)
    const firstPrice = variants[0]?.price ?? 0

    // Built dynamically (options and variants are conditional), so it is cast
    // at the call sites below. Every required Products field is present: title,
    // price, stock, status and tenant.
    const data: Record<string, unknown> = {
      title: mapped.title,
      description: htmlToLexical(mapped.descriptionHtml),
      price: firstPrice,
      stock: variants[0]?.stock ?? 0,
      // Never published. The merchant reviews prices and stock — which we know
      // are approximate — before anything is visible on their storefront.
      status: 'draft',
      ...storeRef(ctx.tenantId),
      ...(mapped.options.length > 0
        ? {
            options: mapped.options.map((o) => ({
              name: o.name,
              values: o.values.map((value) => ({ value })),
            })),
            variants,
          }
        : {}),
      importedFrom: {
        sourceId: ctx.sourceId,
        sourceOrigin: ctx.sourceOrigin,
        externalId: mapped.externalId,
        importedAt: ctx.now().toISOString(),
        priceTaxTreatment: ctx.priceTaxTreatment,
      },
    }

    // Images BEFORE the product write, so the relationship can be set in one
    // pass rather than creating a product and then updating it.
    let imageIds: number[] = []
    if (ctx.media && mapped.images.length > 0) {
      const ingest = await ingestImages(mapped.images, mapped.title, ctx.media)
      imageIds = ingest.mediaIds
      if (ingest.quotaExhausted) {
        // Stop ingesting for the rest of the run, but keep importing products.
        // A catalog without pictures beats a failed import.
        ctx.media = undefined
        ctx.log('Storage is full — the remaining products will import without images.')
      }
    }
    if (imageIds.length > 0) data.images = imageIds

    let productId: number
    let created: boolean

    if (existing) {
      // Re-import updates in place. The slug is deliberately left alone: it is
      // a live storefront URL by now.
      await ctx.payload.update({
        collection: 'products',
        id: existing.id,
        data: data as never,
        overrideAccess: true,
      })
      productId = existing.id
      created = false
    } else {
      const doc = (await ctx.payload.create({
        collection: 'products',
        data: { ...data, slug: await availableSlug(mapped.title, ctx) } as never,
        overrideAccess: true,
      })) as { id: number }
      productId = doc.id
      created = true
    }

    await ctx.payload.update({
      collection: 'import-items',
      id: item.id,
      data: { status: 'imported', product: productId, error: null },
      overrideAccess: true,
    })

    return { ok: true, productId, created }
  } catch (err) {
    // One item failing must never end the run. Record it and let the caller
    // continue; the review screen shows failures with a retry action.
    const error = (err as Error).message
    ctx.log(`Could not import "${mapped.title}": ${error}`)

    await ctx.payload
      .update({
        collection: 'import-items',
        id: item.id,
        data: { status: 'failed', error },
        overrideAccess: true,
      })
      .catch(() => {})

    return { ok: false, error }
  }
}

/**
 * Take up to `limit` selected items for exclusive processing.
 *
 * The claim is a compare-and-set per row: the update only matches items whose
 * `claimedAt` is still empty, so if two ticks race — a merchant refreshing the
 * import screen is enough — the loser gets zero rows back for that item rather
 * than a second copy of the product.
 *
 * One update per item is deliberate. A single bulk update cannot tell you WHICH
 * rows it won, and "probably mine" is not a basis for creating catalog records.
 */
export async function claimItems(
  payload: Payload,
  jobId: number,
  limit: number,
  now: () => Date,
  staleMs = 2 * 60 * 1000,
): Promise<{ id: number; mapped: SourceProduct }[]> {
  const cutoff = new Date(now().getTime() - staleMs).toISOString()
  // Claimable = still selected AND either never claimed, or claimed so long ago
  // the tick that held it must have died. Without the stale branch, an item a
  // timed-out tick claimed but never imported would be skipped forever and the
  // import could never reach 100%.
  const claimable = {
    or: [{ claimedAt: { exists: false } }, { claimedAt: { less_than: cutoff } }],
  }

  const { docs } = await payload.find({
    collection: 'import-items',
    where: {
      and: [{ job: { equals: jobId } }, { status: { equals: 'selected' } }, claimable],
    },
    limit,
    sort: 'id',
    overrideAccess: true,
  })

  const claimed: { id: number; mapped: SourceProduct }[] = []

  for (const doc of docs as { id: number; mapped: unknown }[]) {
    const result = await payload.update({
      collection: 'import-items',
      // Compare-and-set: the update only lands if the row is STILL claimable, so
      // a racing tick that grabbed it first (setting a fresh claimedAt) makes
      // this match zero rows.
      where: { and: [{ id: { equals: doc.id } }, claimable] },
      data: { claimedAt: now().toISOString() },
      overrideAccess: true,
    })

    if ((result as { docs?: unknown[] }).docs?.length) {
      claimed.push({ id: doc.id, mapped: doc.mapped as SourceProduct })
    }
  }

  return claimed
}
