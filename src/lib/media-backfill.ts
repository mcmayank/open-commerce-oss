/**
 * Decides which media docs the backfill reprocesses, separated from doing it.
 *
 * Ingest processing (MEDIA-PIPELINE Task 1) only affects NEW uploads, so every
 * image already in the bucket is still a raw original with no variants — and
 * `srcset` (Task 4) has nothing to offer for them. This is what connects the two.
 *
 * Pure, so the question "what would this touch" is answerable without a bucket.
 */

export interface BackfillDocLike {
  id: number | string
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  sizes?: Record<string, { filename?: string | null } | null | undefined> | null
}

export type SkipReason =
  | 'already-processed'
  | 'not-an-accepted-image'
  | 'no-filename'

export interface BackfillPlan {
  process: BackfillDocLike[]
  skip: { doc: BackfillDocLike; reason: SkipReason }[]
}

/**
 * Mime types the `media` collection accepts today. Must stay in step with
 * `Media.upload.mimeTypes` — a doc whose type is no longer accepted CANNOT be
 * re-uploaded, because the allowlist rejects it on the way back in.
 *
 * That is not hypothetical: production holds an SVG store logo and a webm, both
 * uploaded before the allowlist existed. Reprocessing them would throw, so they
 * are skipped and left exactly as they are.
 */
export const REPROCESSABLE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

/** True when the doc already carries generated variants. */
export function hasVariants(doc: BackfillDocLike): boolean {
  return Object.values(doc.sizes ?? {}).some((s) => Boolean(s?.filename))
}

/**
 * Split the collection into what gets reprocessed and what is deliberately left
 * alone, with a reason for every exclusion.
 *
 * Skipping already-processed docs is what makes the script idempotent and
 * re-runnable after a partial failure — which matters, because each doc is four
 * bucket writes and a long run WILL be interrupted at some point.
 */
export function planMediaBackfill(docs: BackfillDocLike[]): BackfillPlan {
  const plan: BackfillPlan = { process: [], skip: [] }

  for (const doc of docs) {
    if (hasVariants(doc)) {
      plan.skip.push({ doc, reason: 'already-processed' })
    } else if (!doc.filename) {
      plan.skip.push({ doc, reason: 'no-filename' })
    } else if (!REPROCESSABLE_MIME_TYPES.has(String(doc.mimeType ?? ''))) {
      plan.skip.push({ doc, reason: 'not-an-accepted-image' })
    } else {
      plan.process.push(doc)
    }
  }

  return plan
}

/** Human summary of why things were skipped, for the run log. */
export function summariseSkips(plan: BackfillPlan): Record<SkipReason, number> {
  const counts: Record<SkipReason, number> = {
    'already-processed': 0,
    'not-an-accepted-image': 0,
    'no-filename': 0,
  }
  for (const { reason } of plan.skip) counts[reason]++
  return counts
}
