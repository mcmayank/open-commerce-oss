import type { SectionRecipe } from '@/blocks/recipe/types'
import type { RecipeContent } from '@/blocks/recipe/RecipeSection'

/**
 * Reduce a stored `content` row to exactly the slots its recipe declares.
 *
 * Dropping happens at READ, never at write. A merchant who removes a slot from a
 * recipe and later adds it back gets their copy returned, because nothing ever
 * deleted it from the row. That is the whole reason this is a read-side function
 * and not a `beforeChange` hook.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function headerSlotNames(recipe: SectionRecipe): Set<string> {
  const names = new Set<string>()
  const header = recipe.header
  if (!header) return names
  for (const ref of [header.eyebrow, header.heading, header.body]) {
    if (ref) names.add(ref.name)
  }
  return names
}

/** `media` and `badge` carry an optional slot; the rest require one. */
function itemSlotNames(recipe: SectionRecipe): Set<string> {
  const names = new Set<string>()
  for (const atom of recipe.items?.template ?? []) {
    if (atom.slot) names.add(atom.slot.name)
  }
  return names
}

/**
 * `Object.hasOwn`, not `name in source` and not a bare read: a JSON row can carry
 * inherited-looking keys, and reaching Object.prototype is how the icon registry
 * shipped a crash in plan 1.
 *
 * `Object.defineProperty`, not `out[name] = …`: a slot name is merchant data.
 * `parseSlot` (src/blocks/recipe/parse.ts) accepts any non-empty string, so a
 * recipe may legitimately declare a slot called `__proto__`, and for a row that
 * came through JSON.parse that key is an own property of `source`. Plain
 * assignment would then hit Object.prototype's `__proto__` setter and re-point
 * the RETURNED object's prototype at merchant-controlled data instead of
 * creating an own key — every attacker-chosen key on it would read back as an
 * inherited property of the cleaned content. defineProperty always defines an
 * own property and never invokes a setter.
 */
function pick(source: unknown, allowed: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!isPlainObject(source)) return out
  for (const name of allowed) {
    if (!Object.hasOwn(source, name)) continue
    Object.defineProperty(out, name, {
      value: source[name],
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  return out
}

/**
 * Both `header` and `items` are always populated, never undefined — the function
 * unconditionally returns both keys as non-optional. Callers never need to guard.
 */
export function cleanRecipeContent(recipe: SectionRecipe, raw: unknown): Required<RecipeContent> {
  const content = isPlainObject(raw) ? raw : {}
  const allowedItemSlots = itemSlotNames(recipe)
  const rawItems = Array.isArray(content.items) ? content.items : []
  // Slice BEFORE mapping, not after. `content` has no size cap at the write
  // boundary and deliberately never will — dropping at read is what lets a
  // merchant's copy survive a slot being removed and re-added, and a write-time
  // cap would fight that. But one authenticated PATCH can still store 200,000
  // items, and mapping them all only for RecipeSection to keep `source.count`
  // (max 12) means unbounded allocation on every render, plus a row large enough
  // that getPageBySlug silently stops caching. `?? 0` because a recipe with no
  // `items` declares no item slots at all: every entry cleans to `{}` anyway, so
  // keeping any of them is pure waste.
  const limit = recipe.items?.source.count ?? 0
  return {
    header: pick(content.header, headerSlotNames(recipe)),
    items: rawItems.slice(0, limit).map((item) => pick(item, allowedItemSlots)),
  }
}
