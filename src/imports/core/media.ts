/**
 * Image ingest — the expensive part of an import.
 *
 * This does NOT build a media pipeline. `docs/MEDIA-PIPELINE.md` shipped one and
 * this reuses it end to end: bytes go through `payload.create` on the `media`
 * collection, which is what makes sharp run, `imageSizes` generate the
 * thumb/card/hero variants the storefront reads, and the storage-quota hooks
 * stay accurate. Writing to the bucket directly would bypass all three.
 *
 * Bytes are fetched here and ONLY here — discovery and review move none.
 */
import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import { MAX_IMAGE_BYTES, type SafeFetch } from './fetch'
import type { SourceImage } from './types'
import { storeWhere, storeRef } from '@/store-scope'

/** Exactly what `Media.upload.mimeTypes` accepts. SVG is deliberately absent. */
const ACCEPTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

const EXTENSION_FOR: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

/** Per product. A gallery beyond this is not worth the storage on an import. */
/**
 * Five, not ten, so the PRODUCT cap is the limit a merchant meets first.
 *
 * Measured against this repo's own backfill (~540 KB per image once main,
 * thumb, card and hero are stored): 50 products x 10 images is ~270 MB against
 * Free's 250 MB, so storage would run out before the 50-product ceiling and the
 * merchant would get "storage full" instead of a clean, explainable limit.
 * At five it is ~135 MB, with room to spare.
 */
const MAX_IMAGES_PER_PRODUCT = 5

export type ImageBudget = { remainingBytes: number }

export const createImageBudget = (bytes: number): ImageBudget => ({ remainingBytes: bytes })

export type MediaContext = {
  payload: Payload
  tenantId: number
  fetch: SafeFetch
  log: (message: string) => void
  /**
   * SHA-256 of downloaded bytes → media id. An in-memory cache in front of the
   * `media.contentHash` lookup, so a batch does not re-query for a file it just
   * uploaded. The DURABLE dedupe is the column: this map only lives for one
   * tick, and re-importing a catalog spans many.
   */
  seen: Map<string, number>
  budget: ImageBudget
}

export type IngestResult = {
  /** Images resolved to an existing media document instead of being uploaded. */
  reused: number
  mediaIds: number[]
  /** Images that could not be used. Never a reason to fail the product. */
  skipped: number
  /** True when the per-product cap dropped images. */
  truncated: boolean
  /** True when the job's byte ceiling stopped ingest. */
  budgetExhausted: boolean
  /** True when the tenant's storage quota refused an upload. */
  quotaExhausted: boolean
}

/** A storage-quota refusal is not a bad image — it stops the whole run's ingest. */
function isQuotaError(message: string): boolean {
  return /storage|quota|limited to .* of storage/i.test(message)
}

function filenameFor(url: string, mime: string): string {
  const extension = EXTENSION_FOR[mime] ?? 'jpg'
  const last = url.split('?')[0].split('/').pop() ?? 'image'
  const stem = last.replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'image'
  return `${stem}.${extension}`
}

/**
 * Derive the mime type from the response, cross-checked against the extension.
 * Neither is trustworthy alone: a CDN can serve `application/octet-stream` for
 * a perfectly good JPEG, and a `.jpg` URL can return anything at all.
 */
function resolveMime(response: { headers: Headers }, url: string): string | null {
  const declared = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (ACCEPTED_MIME.has(declared)) return declared

  // A declared type we do not accept is an ANSWER, not a gap. Falling through
  // to the extension here would let `image/svg+xml` served from a `.jpg` URL be
  // "rescued" into image/jpeg and pushed at sharp — which is the one type the
  // media allowlist exists to keep out.
  if (declared !== '' && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream') {
    return null
  }

  // Only now is the extension worth consulting: some CDNs serve every asset as
  // octet-stream, and a missing header tells us nothing either way.
  const extension = (url.split('?')[0].split('.').pop() ?? '').toLowerCase()
  const normalized = extension === 'jpeg' ? 'jpg' : extension
  for (const [mime, ext] of Object.entries(EXTENSION_FOR)) {
    if (ext === normalized) return mime
  }

  return null
}

/**
 * Find a media document in this tenant holding exactly these bytes.
 *
 * ANDed with the tenant on purpose: a hash is global but media is not, and
 * reusing another store's document would leak a file across tenants.
 */
async function findByHash(hash: string, ctx: MediaContext): Promise<number | undefined> {
  try {
    const { docs } = await ctx.payload.find({
      collection: 'media',
      where: {
        and: [storeWhere(ctx.tenantId), { contentHash: { equals: hash } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return (docs[0] as { id: number } | undefined)?.id
  } catch {
    // A failed lookup must not fail the import — worst case is a re-upload,
    // which is exactly the behaviour this replaced.
    return undefined
  }
}

export async function ingestImages(
  images: SourceImage[],
  productTitle: string,
  ctx: MediaContext,
): Promise<IngestResult> {
  const result: IngestResult = {
    mediaIds: [],
    reused: 0,
    skipped: 0,
    truncated: false,
    budgetExhausted: false,
    quotaExhausted: false,
  }

  const ordered = [...images].sort((a, b) => a.position - b.position)
  if (ordered.length > MAX_IMAGES_PER_PRODUCT) {
    result.truncated = true
    ctx.log(
      `"${productTitle}" has ${ordered.length} images; importing the first ${MAX_IMAGES_PER_PRODUCT}.`,
    )
  }

  for (const image of ordered.slice(0, MAX_IMAGES_PER_PRODUCT)) {
    if (ctx.budget.remainingBytes <= 0) {
      result.budgetExhausted = true
      break
    }

    const response = await ctx.fetch(image.url, { maxBytes: MAX_IMAGE_BYTES })
    if (!response.ok) {
      result.skipped++
      ctx.log(`Could not fetch an image for "${productTitle}": ${response.message}`)
      continue
    }

    const mime = resolveMime(response, image.url)
    if (!mime) {
      // An SVG or a video reaching `payload.create` throws from inside the
      // upload pipeline; catching it here keeps the message about the image.
      result.skipped++
      ctx.log(`Skipped an unsupported image type for "${productTitle}" (${image.url}).`)
      continue
    }

    // Identical bytes, one upload. Hashing the CONTENT rather than the URL is
    // what catches the same file served under a per-variant URL.
    const hash = createHash('sha256').update(response.body).digest('hex')

    const already = ctx.seen.get(hash) ?? (await findByHash(hash, ctx))
    if (already !== undefined) {
      // Same bytes already in this store. Re-import relies on this: without it
      // a second run updates every product and re-uploads every image.
      ctx.seen.set(hash, already)
      result.reused++
      result.mediaIds.push(already)
      continue
    }

    try {
      const doc = (await ctx.payload.create({
        collection: 'media',
        data: { alt: image.alt || productTitle, ...storeRef(ctx.tenantId), contentHash: hash } as never,
        // Payload's own File type (Task 0): a Buffer plus metadata, not a Web
        // File. This is the path that runs sharp and the quota hooks.
        file: {
          data: response.body,
          mimetype: mime,
          name: filenameFor(image.url, mime),
          size: response.body.length,
        },
        overrideAccess: true,
      })) as { id: number }

      ctx.seen.set(hash, doc.id)
      ctx.budget.remainingBytes -= response.body.length
      result.mediaIds.push(doc.id)
    } catch (err) {
      const message = (err as Error).message
      result.skipped++

      if (isQuotaError(message)) {
        // Not a bad image — the store is full. The caller stops ingesting and
        // finishes the products, because products without pictures beat a
        // failed import.
        result.quotaExhausted = true
        ctx.log(`Storage quota reached while importing images: ${message}`)
        break
      }

      ctx.log(`Could not store an image for "${productTitle}": ${message}`)
    }
  }

  return result
}
