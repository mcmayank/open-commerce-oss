import type React from 'react'
import { FEATURE_ICONS } from '@/blocks/FeatureGrid/icons'
import { INCENTIVE_ICONS } from '@/blocks/Incentives/icons'

/**
 * A recipe's `icon` atom is neither FeatureGrid nor Incentives — it is a
 * generic section built from this plan's vocabulary, so it needs a registry
 * of its own rather than inheriting one shipped block's closed set (the
 * defect this module fixes: `atoms.tsx` used to resolve every recipe icon
 * against `FEATURE_ICONS` alone, silently rendering the wrong glyph for any
 * Incentives-only key). `RECIPE_ICONS` is the union of both, so any icon
 * either shipped block can show is also expressible in a recipe.
 *
 * `truck` is the one key both source maps share. Diffed byte-for-byte, the
 * two `truck` SVGs are identical (same path/circle geometry, same stroke
 * props) — so there is nothing to pick a winner between; the spread order
 * below is arbitrary and no content is lost either way.
 *
 * No options array is exported here on purpose: there is no authoring UI for
 * recipe icons yet (that is a later plan), so a `select`'s options list would
 * be unused dead weight, not a real consumer.
 *
 * Built with `Object.create(null)` rather than an object literal: the lookup
 * key in `atoms.tsx` (`RECIPE_ICONS[key] ?? RECIPE_ICONS.star`) comes straight
 * out of unvalidated content JSON, so a stored `{ icon: "__proto__" }` (or
 * `"constructor"` / `"toString"`) must not resolve to anything on
 * `Object.prototype` — all three are there, all truthy, so `??` would never
 * reach the `star` fallback and rendering would throw. `FEATURE_ICONS` and
 * `INCENTIVE_ICONS` don't need this same treatment: their icon value comes
 * from a Payload `select` field with a closed, validated options list, so an
 * untrusted key can never reach their lookup in the first place. A recipe's
 * icon key is read straight out of unvalidated content, so this registry is
 * exposed in a way the shipped blocks' own maps are not — the safety has to
 * live here, as a property of the registry, not at each call site.
 */
export const RECIPE_ICONS: Record<string, React.FC> = Object.assign(
  Object.create(null) as Record<string, React.FC>,
  FEATURE_ICONS,
  INCENTIVE_ICONS,
)

/**
 * Options for the content form's icon input. Derived, never hand-maintained.
 * `RECIPE_ICONS` has a null prototype, so `Object.keys` returns exactly its
 * own keys — nothing from `Object.prototype` leaks into this list.
 */
export const RECIPE_ICON_OPTIONS: readonly string[] = Object.keys(RECIPE_ICONS).sort()
