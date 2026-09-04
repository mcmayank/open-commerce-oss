/** Pure option-axis logic shared by the admin variant field and the storefront selector.
 *  No React, no DB — everything here is unit-tested in variants.test.ts. */

export interface VariantOptionValue {
  option: string
  value: string
}

export interface ProductOption {
  name: string
  values: { value: string }[]
}

export interface ProductVariant {
  id?: string | null
  title?: string | null
  price: number
  sku?: string | null
  /**
   * NOT NULL DEFAULT 0 in Postgres. Read it through `isInStock`
   * (`src/lib/inventory.ts`) rather than comparing it directly — a gift-card
   * denomination carries a meaningless 0 and is always available.
   */
  stock: number
  optionValues?: VariantOptionValue[] | null
}

/** axisName -> chosen value */
export type Selection = Record<string, string>

/** The value a variant carries on a given axis, or undefined. */
function variantValue(variant: ProductVariant, axisName: string): string | undefined {
  return variant.optionValues?.find((o) => o.option === axisName)?.value ?? undefined
}

/** Join a variant's tagged values in the axis order defined by `options`. Empty string when untagged. */
export function deriveVariantTitle(
  optionValues: VariantOptionValue[] | null | undefined,
  options: ProductOption[],
): string {
  if (!optionValues || optionValues.length === 0) return ''
  return options
    .map((ax) => optionValues.find((o) => o.option === ax.name)?.value)
    .filter((v): v is string => !!v)
    .join(' / ')
}

/** True when every defined axis has a chosen value in the selection. */
export function isCompleteSelection(selection: Selection, options: ProductOption[]): boolean {
  return options.every((ax) => !!selection[ax.name])
}

/** Resolve a COMPLETE selection to its variant row, or null. */
export function resolveVariant(
  selection: Selection,
  variants: ProductVariant[],
  options: ProductOption[],
): ProductVariant | null {
  if (!isCompleteSelection(selection, options)) return null
  return (
    variants.find((v) => options.every((ax) => variantValue(v, ax.name) === selection[ax.name])) ?? null
  )
}

/** Values of `axisName` that can still form a real variant row given the rest of the selection.
 *  The axis's own current selection is ignored, so picking a value never disables its siblings. */
export function availableValues(
  axisName: string,
  selection: Selection,
  variants: ProductVariant[],
  options: ProductOption[],
): Set<string> {
  const set = new Set<string>()
  for (const v of variants) {
    const matchesRest = options.every(
      (ax) => ax.name === axisName || !selection[ax.name] || variantValue(v, ax.name) === selection[ax.name],
    )
    if (!matchesRest) continue
    const val = variantValue(v, axisName)
    if (val) set.add(val)
  }
  return set
}

/** Min/max price (minor units) across all variants; zeros when empty. */
export function variantPriceRange(variants: ProductVariant[]): { min: number; max: number } {
  if (variants.length === 0) return { min: 0, max: 0 }
  const prices = variants.map((v) => v.price)
  return { min: Math.min(...prices), max: Math.max(...prices) }
}
