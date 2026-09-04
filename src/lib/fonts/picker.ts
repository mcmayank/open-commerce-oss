/**
 * Trims a catalog entry down to what the admin picker needs.
 *
 * Lives here rather than inline in src/app/api/fonts/route.ts because Next.js
 * type-checks route modules against a fixed export whitelist (GET, POST,
 * dynamic, …) — any other named export, function or type, fails `next build`
 * with "is not a valid Route export field". The route imports and calls this;
 * it does not re-export it.
 */
import { toAxes } from './catalog'
import { buildFontHref } from './url'
import type { CatalogFamily, PickerFamily } from './types'

/**
 * The raw CatalogFamily carries `weights`, `subsets` and `hasItalic`, none of
 * which the client reads — the axes snapshot is written server-side by
 * resolveThemeFonts, so the browser never computes a font URL. Measured
 * against the committed snapshot, the raw shape is ~184 bytes/family and this
 * one ~63, so a full 1,800-family catalog goes from roughly 323 KB to 111 KB
 * on every picker mount.
 *
 * `selectable` is computed here rather than shipped as raw weights because it
 * is the one question the client needs answered and cannot answer cheaply: a
 * static family whose every weight falls outside the 300–800 window the
 * storefront requests yields a null href, so picking it would render no
 * custom font at all, with no error. Deriving it from buildFontHref means
 * this flag and the storefront's real behaviour cannot disagree.
 */
export function toPickerFamily(entry: CatalogFamily): PickerFamily {
  return {
    family: entry.family,
    category: entry.category,
    variable: entry.variable !== null,
    selectable: buildFontHref([{ family: entry.family, axes: toAxes(entry) }]) !== null,
  }
}
