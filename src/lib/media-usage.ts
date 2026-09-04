/**
 * What a media doc actually occupies in the bucket.
 *
 * `doc.filesize` is the MAIN file alone. Since ingest processing landed
 * (MEDIA-PIPELINE Task 1) one upload produces four objects — the processed main
 * file plus thumb, card and hero — so metering `filesize` undercounts what the
 * merchant is storing by roughly two thirds.
 *
 * Pure and Payload-free on purpose: the collection's hooks and the reconcile
 * script (Task 3) must agree on one definition, and a quota that is about to
 * become a commercial gate should be checkable without booting Payload.
 */

/** The shape both the hooks and a raw DB row satisfy. */
export interface MediaSizeLike {
  filesize?: number | null
}

export interface MediaDocLike {
  filesize?: number | null
  sizes?: Record<string, MediaSizeLike | null | undefined> | null
}

/** Coerce a Payload numeric column, which arrives as number | string | null. */
export function bytes(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Total stored bytes: the main file plus every generated size.
 *
 * Media uploaded before ingest processing has no `sizes`, so this returns their
 * `filesize` unchanged — the counter stays correct across the boundary without a
 * backfill.
 */
export function totalStoredBytes(doc: MediaDocLike | null | undefined): number {
  if (!doc) return 0
  let total = bytes(doc.filesize)
  for (const size of Object.values(doc.sizes ?? {})) total += bytes(size?.filesize)
  return total
}
