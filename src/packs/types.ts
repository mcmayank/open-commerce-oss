/**
 * A sample catalogue: the starter content one kind of shop gets. Data only —
 * the seeding engine in src/lib/sample-seed.ts turns this into rows.
 *
 * Prices are integer MINOR units throughout, per the money guardrail in
 * CLAUDE.md. 2800 means 28.00 in the store's currency.
 */
export interface SampleProductOption {
  /** Axis name shown in the admin, e.g. "Size". */
  name: string
  /** Allowed values for the axis, e.g. ['S', 'M', 'L']. */
  values: string[]
}

export interface SampleVariant {
  /** One entry per option axis. `option` must match a SampleProductOption.name. */
  optionValues: { option: string; value: string }[]
  priceMinor: number
  stock: number
  sku?: string
}

export interface SampleProduct {
  slug: string
  title: string
  /** Plain text. The seeder wraps it in a Lexical paragraph. */
  description: string
  priceMinor: number
  stock: number
  /** Must match a SampleCategory.slug in the same catalogue. */
  categorySlug: string
  /** Filename inside this pack's images/ directory. */
  image: string
  options?: SampleProductOption[]
  variants?: SampleVariant[]
}

export interface SampleCategory {
  slug: string
  title: string
  description: string
}

export interface SampleCatalogue {
  /** Must equal this catalogue's key in SAMPLE_CATALOGUES. */
  slug: string
  /** Shown in the picker, e.g. "Bakery & café". */
  label: string
  /**
   * The currency these prices were authored against. Documentation only —
   * the seeder applies priceMinor as-is under the tenant's own currency and
   * never converts. Inventing an exchange rate for sample data would be a
   * worse lie than a round number.
   */
  authoredCurrency: string
  categories: SampleCategory[]
  products: SampleProduct[]
  /** Blocks for the pack's home page. Optional — a pack without one keeps the
   *  generic fallback in src/lib/default-home.ts. */
  homepage?: PackBlock[]
}

/**
 * One Payload block in a pack's homepage, with any tenant-scoped id expressed
 * as a symbolic reference instead.
 *
 * Packs never store ids — the rows do not exist until the pack is applied — so
 * a block names its own catalogue entry with a single-key object,
 * `{ $product: 'sourdough-loaf' }`, `{ $category: 'breads' }` or
 * `{ $media: 'loaf.webp' }`, and `resolvePackRefs` (src/packs/resolve-refs.ts)
 * swaps in the real ids at seed time. That module owns the authoritative list
 * of sentinels and the single-key rule; this comment is documentation only.
 *
 * Deliberately loose. Payload's generated block union is nominal and enormous,
 * and typing against it would mean regenerating this file whenever any block
 * gains a field. The guarantees come from `src/packs/catalogue.test.ts`, which
 * validates every pack's homepage against its own catalogue and the block
 * registry, not from this type.
 */
export type PackBlock = { blockType: string } & Record<string, unknown>
