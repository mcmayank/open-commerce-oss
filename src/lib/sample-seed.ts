import path from 'node:path'
import fs from 'node:fs'
import type { Payload } from 'payload'
import type { SampleCatalogue } from '@/packs/types'
import { packImagesDir } from '@/packs/images.server'
import { collectMediaRefs, resolvePackRefs, type RefMaps } from '@/packs/resolve-refs'
import { buildDefaultHomeLayout, isUntouchedDefaultHome } from '@/lib/default-home'
import { storeWhere, storeRef } from '@/store-scope'
import { loadStoreById } from '@/store-loader-overlay'

/** Rows touched per collection. Shared by seeding and removal. */
export type SampleCounts = { media: number; categories: number; products: number; pages: number }

export type SeedResult = SampleCounts & {
  /**
   * True when the pack ships a homepage and the tenant's own `home` page was
   * left alone because they had already edited it. The catalogue still seeded;
   * only the homepage stage was skipped. Callers must tell the merchant, or the
   * pack's layout simply fails to appear with no explanation.
   */
  homepageSkipped: boolean
}

/**
 * Thrown when seeding fails, carrying whether the unwind actually left the
 * store clean. `rollback()` is best-effort — it logs and keeps going when an
 * individual delete fails — so callers must not promise "nothing was changed"
 * unless `rolledBack` is true.
 */
export class SampleSeedError extends Error {
  readonly rolledBack: boolean
  constructor(cause: unknown, rolledBack: boolean) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = 'SampleSeedError'
    this.rolledBack = rolledBack
  }
}

/** Payload stores richText as Lexical. Sample descriptions are plain strings. */
function lexicalParagraph(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text, version: 1 }], version: 1 },
      ],
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

/**
 * Create one business type's starter content for a tenant.
 *
 * Order is not arbitrary: a product cannot reference a category or a media row
 * that does not exist yet, so these three stages are strictly sequential.
 *
 * Everything goes through Payload rather than SQL so the upload pipeline
 * generates the thumb/card/hero variants `mediaSrcSet()` reads, and so the
 * storage-quota hooks stay accurate.
 *
 * On ANY failure every row created by this call is deleted in reverse order.
 * A half-seeded store is worse than an empty one: the merchant cannot re-seed
 * (the endpoint refuses non-empty catalogues) and cannot easily clean up.
 */
export async function seedSampleCatalogue({
  payload,
  tenantId,
  catalogue,
}: {
  payload: Payload
  tenantId: number
  catalogue: SampleCatalogue
}): Promise<SeedResult> {
  const imagesDir = packImagesDir(catalogue.slug)
  const created = {
    media: [] as number[],
    categories: [] as number[],
    products: [] as number[],
    pages: [] as number[],
  }

  try {
    // ── 0. Decide the homepage stage's fate, before anything is written ───
    // Every tenant already has a `home` page (provisionHomePage, called from
    // Tenants' afterChange hook at creation). Overwriting it unconditionally
    // destroys the work of a merchant who designed their homepage before adding
    // their first product — a perfectly ordinary sequence, since the page
    // builder and the "add your first product" step are independent. There is no
    // undo: the overwrite is an update, nothing is snapshotted, and removal can
    // only rebuild the generic default.
    //
    // So: seed the catalogue either way, but only install the pack's homepage
    // over a page that is still untouched. Decided here rather than at stage 4
    // so a homepage we are going to skip does not drag its images in with it.
    const packHomepage = catalogue.homepage?.length ? catalogue.homepage : null
    let existingHomeId: string | number | null = null
    let homepageSkipped = false
    if (packHomepage) {
      const found = await payload.find({
        collection: 'pages',
        where: { and: [storeWhere(tenantId), { slug: { equals: 'home' } }] },
        limit: 1,
        depth: 0,
        // `Pages` has drafts on and no autosave, so a merchant who saved without
        // publishing leaves the PUBLISHED row holding the untouched provisioned
        // default while their actual work sits in `_pages_v`. Without this the
        // guard fingerprints that stale default, calls the page untouched, and
        // stage 4 publishes the pack's layout straight over the draft.
        //
        // Far from hypothetical: src/collections/Pages.ts forces every page
        // write arriving through the tenant MCP server to `_status: 'draft'`
        // ("AI writes drafts, humans publish"), so a merchant composing their
        // homepage through the documented AI authoring path is in exactly this
        // state every time. The admin's own "Save draft" button does the same.
        //
        // For a tenant that has never drafted there is no newer version, so this
        // still returns the published starter page and the untouched path is
        // unchanged. `draft: true` also returns the parent doc's id, not a
        // version id, so `existingHomeId` stays the right thing to update.
        draft: true,
        overrideAccess: true,
      })
      const home = found.docs[0]
      if (home) {
        existingHomeId = home.id
        homepageSkipped = !isUntouchedDefaultHome(
          home.layout,
          await resolveStoreName(payload, tenantId),
        )
      }
    }
    // The homepage decision, made once and expressed once: the layout stage 4
    // should install, or null. Every later stage consults THIS rather than
    // re-deriving `packHomepage && !homepageSkipped`, so the two cannot drift.
    const homepageToInstall = homepageSkipped ? null : packHomepage
    // Whether stage 4 actually wrote it. Distinct from `created.pages`, which
    // only tracks rows this run brought into existence.
    let homepageWritten = false

    // ── 1. Media ─────────────────────────────────────────────────────────
    // Every distinct file the pack references: one per product, plus anything
    // the homepage uses that no product does. Keyed by filename so the homepage
    // resolver can find them, and by product slug so products can.
    const mediaBySlug = new Map<string, number>()
    const mediaByFile = new Map<string, number>()

    const wanted = new Set<string>([
      ...catalogue.products.map((p) => p.image),
      // Skipping the homepage means its images have nothing to belong to, so
      // uploading them would leave orphan rows against the storage quota.
      ...collectMediaRefs(homepageToInstall ?? undefined),
    ])

    for (const file of wanted) {
      const filePath = path.join(imagesDir, file)
      if (!fs.existsSync(filePath)) {
        throw new Error(
          `Sample image missing: ${catalogue.slug}/images/${file}. ` +
            `If this only happens in a deployed environment, the images are not ` +
            `in the function bundle — see outputFileTracingIncludes in next.config.ts.`,
        )
      }
      const alt = catalogue.products.find((p) => p.image === file)?.title ?? catalogue.label
      const doc = await payload.create({
        collection: 'media',
        filePath,
        data: { alt, ...storeRef(tenantId), isSampleContent: true },
        overrideAccess: true,
      })
      created.media.push(Number(doc.id))
      mediaByFile.set(file, Number(doc.id))
    }

    for (const product of catalogue.products) {
      mediaBySlug.set(product.slug, mediaByFile.get(product.image)!)
    }

    // ── 2. Categories ────────────────────────────────────────────────────
    const categoryBySlug = new Map<string, number>()
    for (const category of catalogue.categories) {
      const doc = await payload.create({
        collection: 'categories',
        data: {
          title: category.title,
          slug: category.slug,
          description: category.description,
          ...storeRef(tenantId),
          isSampleContent: true,
        },
        overrideAccess: true,
      })
      created.categories.push(Number(doc.id))
      categoryBySlug.set(category.slug, Number(doc.id))
    }

    // ── 3. Products ──────────────────────────────────────────────────────
    const productBySlug = new Map<string, number>()
    for (const product of catalogue.products) {
      const categoryId = categoryBySlug.get(product.categorySlug)
      if (categoryId === undefined) {
        throw new Error(
          `Product "${product.slug}" references unknown category "${product.categorySlug}".`,
        )
      }
      const doc = await payload.create({
        collection: 'products',
        data: {
          title: product.title,
          slug: product.slug,
          description: lexicalParagraph(product.description),
          price: product.priceMinor,
          stock: product.stock,
          status: 'active',
          category: categoryId,
          images: [mediaBySlug.get(product.slug)!],
          ...storeRef(tenantId),
          isSampleContent: true,
          ...(product.options?.length
            ? {
                options: product.options.map((o) => ({
                  name: o.name,
                  values: o.values.map((value) => ({ value })),
                })),
                variants: (product.variants ?? []).map((v) => ({
                  optionValues: v.optionValues,
                  price: v.priceMinor,
                  stock: v.stock,
                  ...(v.sku ? { sku: v.sku } : {}),
                })),
              }
            : {}),
        },
        overrideAccess: true,
      })
      created.products.push(Number(doc.id))
      // Keyed here, in the loop that creates the row, exactly as `categoryBySlug`
      // is. Building it afterwards by zipping `catalogue.products` against
      // `created.products` would work only while the two stay index-aligned.
      productBySlug.set(product.slug, Number(doc.id))
    }

    // ── 4. Homepage ──────────────────────────────────────────────────────
    // Last, because its references resolve against everything above. Optional:
    // a pack with no homepage keeps the fallback in src/lib/default-home.ts,
    // and so does a tenant whose own homepage stage 0 found already edited.
    //
    // Every tenant already has a `home` Page by this point: Tenants' afterChange
    // hook (src/the tenants collection.ts) calls provisionHomePage the moment the
    // tenant row is created, before this function ever runs. `slug` is unique
    // per tenant (src/fields/perTenantSlug.ts), so a blind `create` here always
    // collides with that starter page. Overwrite it in place instead.
    if (homepageToInstall) {
      const refMaps: RefMaps = {
        products: productBySlug,
        categories: categoryBySlug,
        media: mediaByFile,
      }
      const layout = resolvePackRefs(homepageToInstall, refMaps)
      const pageData = {
        isSampleContent: true,
        layout,
        // Pages have drafts enabled. Without this the page exists and is
        // never served, and the storefront silently falls through to its
        // hardcoded fallback — which reads as the feature simply not working.
        _status: 'published',
      }

      // `existingHomeId` was read in stage 0, before any of the writes above.
      // Nothing between there and here creates a page, so it is still current.
      if (existingHomeId !== null) {
        // No `title` here: the provisioned page is already called "Home", and
        // the fingerprint that decided this page was untouched never looks at
        // the title. Sending one would silently rename a merchant who had
        // renamed their homepage — an edit we deliberately do not treat as
        // grounds for skipping, so it must not be grounds for clobbering either.
        await payload.update({
          collection: 'pages',
          id: existingHomeId,
          data: pageData as never,
          overrideAccess: true,
        })
      } else {
        const doc = await payload.create({
          collection: 'pages',
          data: { ...pageData, title: 'Home', slug: 'home', ...storeRef(tenantId) } as never,
          overrideAccess: true,
        })
        // Only a genuinely created row goes in the ledger. `rollback()` deletes
        // every id it holds, so pushing a pre-existing id here would make the
        // unwind destroy the tenant's own home page rather than undo this run.
        created.pages.push(Number(doc.id))
      }
      homepageWritten = true
    }

    return {
      media: created.media.length,
      categories: created.categories.length,
      products: created.products.length,
      // `created.pages` is a rollback ledger, not a report: it deliberately
      // excludes a homepage that was overwritten in place. The count the caller
      // shows the merchant has to include it either way — one page changed.
      pages: created.pages.length + (homepageWritten && existingHomeId !== null ? 1 : 0),
      homepageSkipped,
    }
  } catch (error) {
    const rolledBack = await rollback(payload, created)
    throw new SampleSeedError(error, rolledBack)
  }
}

/**
 * Delete in reverse dependency order so no FK is violated on the way out.
 *
 * Returns true only if every row was removed. A stuck row does not stop the
 * unwind, but it does mean the caller cannot honestly claim the store is
 * untouched, so that fact is reported rather than swallowed.
 */
async function rollback(
  payload: Payload,
  created: { media: number[]; categories: number[]; products: number[]; pages: number[] },
): Promise<boolean> {
  let complete = true
  for (const [collection, ids] of [
    ['pages', created.pages],
    ['products', created.products],
    ['categories', created.categories],
    ['media', created.media],
  ] as const) {
    for (const id of [...ids].reverse()) {
      try {
        await payload.delete({ collection, id, overrideAccess: true })
      } catch (e) {
        // Keep unwinding. One stuck row must not strand the rest.
        complete = false
        payload.logger.error(`Sample rollback: failed to delete ${collection}/${id}: ${e}`)
      }
    }
  }
  return complete
}

/**
 * Best-effort store name for a freshly-restored default home page: the
 * merchant's own `store-settings.storeName` if they've set one, else the
 * tenant's `name` — the same value `provisionHomePage`'s only other caller
 * (the Tenants `afterChange` hook) uses when store-settings doesn't exist yet.
 */
async function resolveStoreName(payload: Payload, tenantId: number): Promise<string> {
  const settings = await payload.find({
    collection: 'store-settings',
    where: storeWhere(tenantId),
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const storeName = (settings.docs[0] as { storeName?: string } | undefined)?.storeName
  if (storeName) return storeName
  return (await loadStoreById(tenantId))?.name ?? 'Store'
}

/**
 * Delete every sample-flagged row for a tenant.
 *
 * Deletes flagged rows even if the merchant edited them. The confirmation copy
 * says so. Clearing the flag on edit sounds kinder and is worse: it strands
 * rows the merchant expected removed and makes the count in the confirmation
 * disagree with what actually gets deleted.
 *
 * Through Payload rather than SQL, so storage-quota hooks fire and the object
 * is removed from the bucket, not just the row from the table.
 *
 * ONE exception to "delete every flagged row": the `home` page. It didn't
 * start as sample content — every tenant gets a real, non-sample `home` page
 * the moment it's created (`provisionHomePage`), and the seeder's homepage
 * stage overwrites that same row rather than adding a second one (see the
 * comment in `seedSampleCatalogue`). Deleting it here would leave the tenant
 * with no home page at all and no way to get one back outside of re-creating
 * the tenant. Instead it is reset to the provisioned default and un-flagged.
 * Any OTHER sample-flagged page a future pack adds is still deleted normally.
 */
export async function removeSampleContent({
  payload,
  tenantId,
}: {
  payload: Payload
  tenantId: number
}): Promise<SampleCounts> {
  const result: SampleCounts = { media: 0, categories: 0, products: 0, pages: 0 }

  for (const collection of ['pages', 'products', 'categories', 'media'] as const) {
    for (;;) {
      const found = await payload.find({
        collection,
        where: {
          and: [storeWhere(tenantId), { isSampleContent: { equals: true } }],
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      if (found.docs.length === 0) break
      for (const doc of found.docs) {
        if (collection === 'pages' && (doc as { slug?: string }).slug === 'home') {
          // Reset in place — the mirror image of how seeding installed it.
          // Deleting and re-provisioning would throw away this page's id, its
          // SEO/AEO fields (meta.title, meta.description, meta.image,
          // aeo.answerSummary) that seeding deliberately never touched, and its
          // version history — the very history that makes a draft overwritten
          // by an earlier build recoverable. It is also non-atomic: a throw
          // between the delete and the re-create leaves the tenant with no home
          // page at all and a storefront 500.
          await payload.update({
            collection: 'pages',
            id: doc.id,
            data: {
              layout: buildDefaultHomeLayout(await resolveStoreName(payload, tenantId)),
              isSampleContent: false,
              // Clearing the flag is what ends the loop: the next `find` in
              // this `for(;;)` no longer matches this row.
              _status: 'published',
            } as never,
            overrideAccess: true,
          })
        } else {
          await payload.delete({ collection, id: doc.id, overrideAccess: true })
        }
        result[collection] += 1
      }
      if (!found.hasNextPage) break
    }
  }

  return result
}
