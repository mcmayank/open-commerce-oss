/**
 * Build a `srcset` from the variants Payload generated at ingest.
 *
 * Deliberately NOT `next/image`. Two reasons, both structural:
 *
 *  - Vercel bills for image optimisation transformations, and we would be paying
 *    it to redo work sharp already did at upload time.
 *  - `next/image` optimisation behaves differently off Vercel, so the
 *    open-source single-store build would serve images differently from the
 *    hosted one. Same codebase, different behaviour, is the divergence this
 *    project avoids everywhere else.
 *
 * Pure and Payload-free: no imports, so it can be unit-tested and used from any
 * render site regardless of how deeply that site's media was populated.
 */

export interface ImageSizeLike {
  url?: string | null
  width?: number | null
}

export interface MediaLike {
  url?: string | null
  width?: number | null
  sizes?: Record<string, ImageSizeLike | null | undefined> | null
}

/**
 * Blocks populate media at varying depth, so a field can arrive as a full doc,
 * a bare id, or null. Anything that is not an object with a `url` is unusable
 * here and must degrade to a plain `src` rather than render a broken image.
 */
function asMedia(media: unknown): MediaLike | null {
  if (!media || typeof media !== 'object') return null
  return media as MediaLike
}

function positiveInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * The URL to use as `src` — the largest available rendition.
 *
 * Falls back to the widest generated size when the main file has no URL, so a
 * doc that is partially populated still renders something rather than nothing.
 */
export function mediaSrc(media: unknown): string | undefined {
  const doc = asMedia(media)
  if (!doc) return undefined
  if (typeof doc.url === 'string' && doc.url) return doc.url

  let widest: { url: string; width: number } | null = null
  for (const size of Object.values(doc.sizes ?? {})) {
    const url = size?.url
    const width = positiveInt(size?.width)
    if (typeof url === 'string' && url && width && (!widest || width > widest.width)) {
      widest = { url, width }
    }
  }
  return widest?.url
}

/**
 * `srcset` covering every generated variant plus the main file.
 *
 * Returns `undefined` when there is nothing useful to offer — a bare id, a doc
 * with no `sizes` (anything uploaded before ingest processing), or sizes with no
 * widths. Call sites MUST treat `undefined` as "just use src": a storefront full
 * of pre-existing media has to keep rendering.
 *
 * Widths are de-duplicated because `withoutEnlargement` means a variant can come
 * out at the source width — a 1086px image yields a `hero` of 1086px, identical
 * to the main file. Two candidates at the same width is a malformed srcset.
 */
export function mediaSrcSet(media: unknown): string | undefined {
  const doc = asMedia(media)
  if (!doc) return undefined

  const byWidth = new Map<number, string>()

  for (const size of Object.values(doc.sizes ?? {})) {
    const url = size?.url
    const width = positiveInt(size?.width)
    if (typeof url === 'string' && url && width && !byWidth.has(width)) byWidth.set(width, url)
  }

  // No variants means nothing to choose between — the browser would have exactly
  // one candidate, which is what a plain `src` already does.
  if (byWidth.size === 0) return undefined

  const mainWidth = positiveInt(doc.width)
  if (typeof doc.url === 'string' && doc.url && mainWidth && !byWidth.has(mainWidth)) {
    byWidth.set(mainWidth, doc.url)
  }

  return [...byWidth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([width, url]) => `${url} ${width}w`)
    .join(', ')
}

/**
 * Intrinsic dimensions for the `width`/`height` attributes.
 *
 * Every storefront `<img>` currently ships without them, which causes layout
 * shift as images load — a real Core Web Vitals problem. Returns the MAIN file's
 * dimensions: the browser only needs the aspect ratio, and every variant shares
 * it because sizes set width only.
 */
export function mediaDimensions(
  media: unknown,
): { width: number; height: number } | undefined {
  const doc = asMedia(media)
  const width = positiveInt(doc?.width)
  const height = positiveInt((doc as { height?: unknown } | null)?.height)
  return width && height ? { width, height } : undefined
}
