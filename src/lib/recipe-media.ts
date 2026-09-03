import { cache } from 'react'
import type { Payload } from 'payload'
import type { SectionRecipe } from '@/blocks/recipe/types'
import type { RecipeContent } from '@/blocks/recipe/RecipeSection'
import type { RecipeMediaDoc } from '@/blocks/recipe/atoms'
import { storeWhere } from '@/store-scope'

/**
 * `content` lives in a json column, so Payload never populates the Media
 * relationship a media slot points at. The render path resolves the ids itself:
 * one batched query per section rather than one per image, deduped across
 * sections on the same page that reference the same ids via React `cache()`.
 *
 * `cache()` keys object/array arguments by REFERENCE (a `WeakMap` per
 * argument position) — it does not compare array contents. `collectMediaIds`
 * builds a fresh array on every call, so if the memoized function took `ids:
 * string[]` directly, two sections referencing the identical media ids would
 * each pass a distinct array instance and each miss the cache, issuing their
 * own query. `resolveRecipeMediaByKey` below therefore takes a single sorted,
 * comma-joined STRING instead — primitives are compared by value — and
 * `resolveRecipeMedia` is the thin wrapper every caller actually uses, doing
 * nothing but building that key so `['7','9']` and `['9','7']` collapse onto
 * the same cache entry.
 */

const SCAN_LIMIT = 200

/**
 * `media.id` is a Postgres **integer** column, and a slot value is unvalidated
 * merchant JSON — `content` is an opaque `json` field, so an AI client writing
 * through the MCP tools can just as easily put a URL string in an image slot as
 * an id. Handing that to `where: { id: { in: [...] } }` raises `22P02 invalid
 * input syntax for type integer`; `CustomSectionComponent` catches it, but the
 * catch replaces the WHOLE map, so one garbage value silently wipes every image
 * in the section and logs a Postgres error on every render.
 *
 * So a slot value only becomes an id if it is a string or a number whose
 * decimal form is all digits. That rejects `'https://cdn/x.jpg'`, `7.5`,
 * `true`, `{}` and `[7, 9]` alike — and rejecting arrays is also what keeps the
 * comma-joined cache key in `resolveRecipeMedia` injective, since
 * `String([7, 9])` is `'7,9'` and would otherwise collide with two separate ids.
 */
const NUMERIC_ID = /^\d+$/

function mediaIdOf(raw: unknown): string | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined
  const id = String(raw)
  return NUMERIC_ID.test(id) ? id : undefined
}

/** Slot names the recipe's media atoms declare. */
function mediaSlotNames(recipe: SectionRecipe): string[] {
  const names: string[] = []
  for (const atom of recipe.items?.template ?? []) {
    if (atom.kind === 'media' && atom.slot) names.push(atom.slot.name)
  }
  return names
}

export function collectMediaIds(
  recipe: SectionRecipe,
  content: Required<RecipeContent>,
): string[] {
  const names = mediaSlotNames(recipe)
  if (names.length === 0) return []

  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of content.items) {
    for (const name of names) {
      const id = mediaIdOf(item[name])
      if (id === undefined) continue
      if (seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

const resolveRecipeMediaByKey = cache(
  async (payload: Payload, tenantId: string | number, idsKey: string): Promise<Map<string, RecipeMediaDoc>> => {
    const ids = idsKey ? idsKey.split(',') : []
    const map = new Map<string, RecipeMediaDoc>()
    if (ids.length === 0) return map

    // `overrideAccess: true` and an explicit `tenant` predicate look like they
    // cancel out; they don't. The storefront renders with no authenticated
    // user, so Media's own tenant-scoped access control has no req.user to
    // check against — overrideAccess just skips a check that could not have
    // run anyway. The `tenant` clause below is what actually does the
    // scoping: `content` is unvalidated merchant JSON, so a recipe instance
    // can name ANY media id, including one belonging to a different tenant.
    // Without this predicate, one tenant's recipe could pull another
    // tenant's image onto its own storefront by id alone.
    const { docs } = await payload.find({
      collection: 'media',
      where: { and: [storeWhere(tenantId), { id: { in: ids } }] },
      limit: Math.min(ids.length, SCAN_LIMIT),
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of docs as RecipeMediaDoc[]) map.set(String(doc.id), doc)
    return map
  },
)

/**
 * Public entry point; every caller uses this, never `resolveRecipeMediaByKey`
 * directly. Sorts `ids` before joining them into the memoized function's
 * cache key — see the module docblock for why a string key, not the array
 * itself, is what makes cross-section deduping actually work.
 */
export async function resolveRecipeMedia(
  payload: Payload,
  tenantId: string | number,
  ids: string[],
): Promise<Map<string, RecipeMediaDoc>> {
  return resolveRecipeMediaByKey(payload, tenantId, [...ids].sort().join(','))
}
