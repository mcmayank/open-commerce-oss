import type { Payload } from 'payload'
import { parseRecipe } from '@/blocks/recipe/parse'

type SeedableBlock = {
  id?: string | null
  blockType?: string | null
  scheme?: string | null
  definition?: unknown
}

/**
 * Fill an unset `scheme` on each newly-*placed* customSection from its definition's
 * published `container.scheme`, mutating the layout in place.
 *
 * "Newly placed" is decided by `id`, the same way `findNewCustomSections` in
 * ./blocks/custom-section-diff.ts decides it for plan enforcement: a block whose
 * `id` was already present as a `customSection` in `originalLayout` existed before
 * this save and is never touched, no matter what its `scheme` holds — including
 * `''`, the value the block's "Theme default" option persists. Seeding on "scheme is
 * empty" instead of "block is new" would silently revert that deliberate choice on
 * every later save of a page that merely contains the block. A block with no `id`
 * has not been persisted yet, so it counts as new.
 *
 * Only for a genuinely new block does `scheme` get consulted: seeding still never
 * overwrites a scheme the merchant set at creation time, so this is additive, not
 * mirroring — it seeds an editable value rather than caching a source of truth, so
 * it cannot go stale.
 *
 * A definition with no published version leaves `scheme` empty and the wrapper in
 * src/blocks/index.tsx resolves 'default'. Seeding from the draft would bake in a
 * band the storefront is not yet serving.
 *
 * Nothing here may throw: a page save must never fail because a definition was
 * deleted, is unreadable, or holds an invalid recipe.
 */
export async function seedCustomSectionSchemes(
  payload: Payload,
  layout: unknown,
  originalLayout: unknown,
): Promise<void> {
  if (!Array.isArray(layout)) return

  const before = new Set<string>()
  if (Array.isArray(originalLayout)) {
    for (const block of originalLayout as SeedableBlock[]) {
      if (block?.id && block.blockType === 'customSection') before.add(block.id)
    }
  }

  for (const block of layout as SeedableBlock[]) {
    if (!block || block.blockType !== 'customSection') continue
    if (block.id && before.has(block.id)) {
      // Consume the match so one original block can grandfather at most one
      // incoming block, mirroring findNewCustomSections.
      before.delete(block.id)
      continue
    }
    if (block.scheme) continue

    const ref = block.definition
    const id =
      typeof ref === 'object' && ref !== null ? (ref as { id?: unknown }).id : ref
    if (id === undefined || id === null || id === '') continue

    try {
      const doc = await payload.findByID({
        collection: 'section-definitions',
        id: id as string | number,
        depth: 0,
        overrideAccess: true,
      })
      if ((doc as { _status?: string })?._status !== 'published') continue
      block.scheme = parseRecipe((doc as { recipe?: unknown }).recipe).container.scheme
    } catch {
      // Unreadable or invalid: leave the scheme unset and let the wrapper resolve
      // 'default'. Failing the save would trap the merchant in an unsavable page.
    }
  }
}
