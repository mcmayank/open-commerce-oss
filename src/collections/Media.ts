import type { CollectionConfig } from 'payload'
import type { Access, Where } from 'payload'
import { storeIdOf } from '@/store-scope'
import { isEnforced, assertStorageQuota } from '@/lib/plan-enforcement'
import { revalidateMediaHook } from '@/lib/storefront-cache'
import { totalStoredBytes } from '@/lib/media-usage'
import { NAV_GROUPS } from './nav-groups'

/**
 * Who may read a media file, including via `/api/media/file/**`.
 *
 * Storefront images must stay public — anonymous visitors render them on every
 * page. But `issueInvoice` writes generated invoice PDFs into this same
 * collection (`src/lib/invoicing/issue.ts`), so they inherited that public read
 * and were fetchable with no auth at `/api/media/file/invoice-INV-2.pdf`, under
 * sequential and trivially guessable names. An invoice carries the customer's
 * name, address, order contents and — since the tax work — the supplier TRN and
 * VAT breakdown.
 *
 * Nothing legitimate depends on that being public: customers receive the PDF as
 * an email attachment (`sendInvoice`), and the only URL consumer is the
 * authenticated admin order view.
 *
 * Deliberately written as "everything except PDFs" rather than an image
 * allowlist. This collection also serves an SVG store logo and a webm
 * background video to anonymous visitors, and an allowlist would silently break
 * them. A null `mimeType` stays public for the same reason — failing open on an
 * image beats blanking a storefront, and the only thing being protected here is
 * a type we generate ourselves and always stamp.
 *
 * This is a targeted fix, not the final shape: invoices are moving to their own
 * collection with their own access rules, and this constraint retires with them.
 *
 * TENANT SCOPING IS THE OTHER HALF, and it was missing. `the hosted tenant-scoping wrapper`
 * defaults `read` to `hostBoundConstraint`, but spreads the collection's own
 * `access` over that default — so declaring `read` here REPLACED host scoping
 * rather than narrowing it. The multi-tenant plugin does not cover the gap: it
 * ANDs `tenant IN (user's tenants)` only when `req.user` is set (see
 * `withTenantAccess`), so an ANONYMOUS read got no tenant constraint at all.
 *
 * Measured on production before this fix: `GET /api/media?limit=100` on ONE
 * store's host returned 96 documents spanning SEVEN tenants — every merchant's
 * filenames, alt text and image URLs, to anyone.
 */

/**
 * The public half: everything except the generated invoice PDFs. A null
 * `mimeType` stays public deliberately — see the note above about failing open.
 */
export const PUBLIC_MEDIA_MIME_CONSTRAINT = {
  or: [{ mimeType: { not_equals: 'application/pdf' } }, { mimeType: { exists: false } }],
} as const

/**
 * Core read rule: signed-in users read everything; anonymous readers get every
 * public type (the storefront renders images by URL) and never a generated
 * invoice PDF. The hosted overlay replaces this with a host-bound rule
 * (src/hosted/access/media-read.ts) that also scopes anonymous reads to the
 * request host's tenant.
 */
export const mediaReadAccess: Access = ({ req }) => {
  if (req.user) return true
  return PUBLIC_MEDIA_MIME_CONSTRAINT as unknown as Where
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: NAV_GROUPS.media },
  access: {
    // create/update stay tenant-guarded by the factory.
    read: mediaReadAccess,
  },
  fields: [
    {
      /**
       * SHA-256 of the bytes as received, set by the product importer.
       *
       * Without it, dedupe can only span one batch: re-importing a catalog
       * updates each product but re-uploads every image, doubling storage on
       * every run. With it, identical bytes resolve to the existing document
       * whenever they are seen again — across ticks, across runs, and across
       * products.
       *
       * Null on anything uploaded by hand. Only the import path sets it, so a
       * lookup must always be ANDed with a tenant and treat null as "no match".
       */
      name: 'contentHash',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: 'Set by the product importer to avoid re-uploading identical files.' },
    },

    { name: 'alt', type: 'text', required: true },
    {
      name: 'isSampleContent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        hidden: true,
        description: 'Created by the sample catalogue seeder.',
      },
    },
  ],
  /**
   * Ingest processing. Before this, whatever a merchant uploaded is what got
   * stored AND served — a 3-5 MB phone photo landed as 3-5 MB and was sent at
   * full resolution to every device, including a shopper on mobile data.
   *
   * `formatOptions` converts the stored main file to WebP; `resizeOptions` caps
   * it at 2000px wide. `imageSizes` generates the variants the storefront picks
   * from. Width only, never height, so aspect ratio is preserved and a portrait
   * product shot is not cropped — do not add `height` without a deliberate crop
   * decision.
   *
   * Four objects per upload (processed main + three sizes), each a Class A write.
   * That is the right trade against delivery size; if write ops ever become a
   * problem, drop `hero` first.
   *
   * The allowlist is the security half. Without it a tenant could upload `.html`
   * and have Niblr serve it from a `*.niblr.store` subdomain — a phishing host
   * carrying our domain name.
   *
   * SVG is deliberately absent even though it is an image type: it can carry
   * script, and serving tenant-uploaded SVG from the merchant's own domain is an
   * XSS vector against their customers. Existing SVG logos keep working — this
   * gates uploads, not reads — but a new one needs a sanitising ingest path
   * (strip script, event handlers and external references) before it can be
   * allowed back. Video is absent for the same reason MEDIA-PIPELINE Task 6
   * removes uploaded video: no transcoding, no adaptive bitrate, and the fastest
   * way for one tenant to exhaust a storage tier.
   *
   * The 25 MB ceiling is NOT here — Payload takes it globally as
   * `upload.limits.fileSize` in `payload.config.ts`, not per collection.
   */
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
    formatOptions: { format: 'webp', options: { quality: 82 } },
    resizeOptions: { width: 2000, withoutEnlargement: true },
    // Each size carries its own `formatOptions` on purpose. The collection-level
    // one above applies to the MAIN file only — measured: without these, the
    // variants come out as image/jpeg while the main file is WebP. The variants
    // are what the storefront actually serves, so that is where the format win
    // matters most.
    imageSizes: [
      {
        name: 'thumb',
        width: 400,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'card',
        width: 800,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'hero',
        width: 1600,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
    ],
  },
  hooks: {
    beforeChange: [
      // Pre-flight quota check. This runs BEFORE sharp, so the processed size
      // cannot be known yet — `req.file.size` is the raw upload, which is
      // typically several times what actually gets stored (measured: 2150 KB in,
      // 414 KB across all four objects out).
      //
      // That over-estimate is deliberate and fails SAFE: it can only reject an
      // upload that would in fact have fitted, never admit one that would not.
      // `afterChange` reconciles to the true figure once the objects exist.
      async ({ req, operation, data, originalDoc }) => {
        const incoming = req.file?.size ?? 0
        if (incoming <= 0 || !isEnforced(req)) return data
        const tenantId = storeIdOf(data as { tenant?: unknown }) ?? storeIdOf(originalDoc)
        if (tenantId === undefined) return data
        const oldSize = operation === 'update' ? totalStoredBytes(originalDoc) : 0
        await assertStorageQuota(req.payload, tenantId, incoming - oldSize)
        return data
      },
    ],
    afterChange: [
      // Hosted prepends the storage-counter reconcile here (src/hosted/access/media-usage-hooks.ts).
      revalidateMediaHook.afterChange,
    ],
    afterDelete: [
      revalidateMediaHook.afterDelete,
    ],
  },
}
