import type { LayoutBlock } from './premium-diff'

/**
 * How many `customSection` blocks this save NEWLY introduces, matched on Payload's
 * stable block `id`.
 *
 * A block already present is grandfathered, which is what lets a downgraded
 * merchant keep editing a page that already carries custom sections instead of
 * being trapped in an unsavable form. Mirrors findNewPremiumVariants in
 * ./premium-diff.ts, which solves the same problem for premium layout variants.
 */
export function findNewCustomSections(
  incoming: LayoutBlock[] | null | undefined,
  original: LayoutBlock[] | null | undefined,
): number {
  if (!Array.isArray(incoming)) return 0

  const before = new Set<string>()
  // Array.isArray, not `original ?? []`: `originalDoc.layout` is whatever the row
  // holds, and a non-array (a `{}` from a partial write, a string) is not
  // iterable — it would throw inside the Pages `beforeChange` hook and block the
  // save outright. seedCustomSectionSchemes guards the same input the same way,
  // and this function's docblock claims the two mirror each other.
  if (Array.isArray(original)) {
    for (const block of original) {
      if (block?.id && block.blockType === 'customSection') before.add(block.id)
    }
  }

  let introduced = 0
  for (const block of incoming) {
    if (block?.blockType !== 'customSection') continue
    // No id means the admin has not persisted this row yet, so it cannot be
    // matched against anything that came before: treat it as new.
    if (block.id && before.has(block.id)) {
      // Consume the match so one original block can grandfather at most one
      // incoming block — otherwise duplicating a grandfathered id would
      // grandfather every duplicate too.
      before.delete(block.id)
      continue
    }
    introduced += 1
  }
  return introduced
}
