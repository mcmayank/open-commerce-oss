/**
 * Shared vocabulary for the Google Fonts integration.
 *
 * `CatalogFamily` is the normalised shape of one entry in Google's catalog.
 * `FontAxes` is the much smaller subset that gets snapshotted onto a store's
 * settings at save time — deliberately not the whole CatalogFamily, because the
 * storefront render path must be able to build a font URL from it alone, with
 * no catalog access and no network call.
 */

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace'

/** One normalised entry from Google's webfonts catalog. */
export interface CatalogFamily {
  family: string
  category: FontCategory
  /** Numeric weight strings, ascending, italics folded out. */
  weights: string[]
  hasItalic: boolean
  /** The `wght` axis range for a variable family; null for a static one. */
  variable: { min: number; max: number } | null
  subsets: string[]
}

/**
 * What is persisted onto StoreSettings alongside the chosen family name.
 *
 * `hasItalic` is recorded even though italics are never requested today (see the
 * spec's "Italics" section) so that turning them on later is a url.ts edit
 * rather than a data migration across every store.
 */
export type FontAxes = { category: FontCategory; hasItalic: boolean } & (
  | { variable: true; min: number; max: number }
  | { variable: false; weights: string[] }
)

/** One resolved font slot — body or heading — ready to be turned into a URL. */
export interface FontSlot {
  family: string
  axes: FontAxes
}

/**
 * What the admin picker actually needs per family. The raw CatalogFamily
 * carries `weights`, `subsets` and `hasItalic`, none of which the client
 * reads — the axes snapshot is written server-side by resolveThemeFonts, so
 * the browser never computes a font URL. Measured against the committed
 * snapshot, the raw shape is ~184 bytes/family and this one ~63, so a full
 * 1,800-family catalog goes from roughly 323 KB to 111 KB on every picker
 * mount.
 *
 * `selectable` is computed server-side (src/app/api/fonts/route.ts) rather
 * than shipped as raw weights because it is the one question the client
 * needs answered and cannot answer cheaply: a static family whose every
 * weight falls outside the 300–800 window the storefront requests yields a
 * null href, so picking it would render no custom font at all, with no
 * error. Deriving it from buildFontHref means this flag and the storefront's
 * real behaviour cannot disagree.
 *
 * Lives here, not in the route module, because a client component
 * (FontField) must not import a type from a route module.
 */
export interface PickerFamily {
  family: string
  category: FontCategory
  variable: boolean
  selectable: boolean
}
