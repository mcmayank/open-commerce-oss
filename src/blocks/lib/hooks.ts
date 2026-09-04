/**
 * The published storefront hook contract, version `nb-hooks/1`.
 *
 * Merchant CSS (StoreSettings.customCss) targets these attributes and nothing
 * else — see docs/THEMING-HOOKS.md. They are an API: a name here may gain
 * blocks that emit it, but must never change meaning, and removing one is a
 * breaking change requiring a contract version bump.
 *
 * The contract is deliberately semantic rather than structural. It promises
 * "an element marked `heading` exists and is the heading", never that the
 * heading is an h2 inside a div — which is what lets block markup be
 * restructured freely.
 *
 * `eyebrow`, `badge`, and `link` were added after the initial eight. Adding a
 * name to this list is not a breaking change and does not bump the version —
 * the version identifies the contract's guarantees (semantic stability,
 * additive-only evolution), not the size of the vocabulary. Only renaming or
 * removing a published name would require `nb-hooks/2`.
 *
 * - `eyebrow` — the small label rendered above a heading (kicker/overline).
 * - `badge` — a small chip carrying a number or status, e.g. a step number.
 * - `link` — a textual link that is not a call to action. `cta` remains the
 *   name for buttons and primary actions.
 *
 * These are deliberately flat, block-level names — there is no `item-badge`
 * or `item-link` variant. `item` already marks the repeated wrapper, so a
 * designer scopes a part to inside an item by combining selectors:
 * `[data-nb-part="item"] [data-nb-part="badge"]`. Steps' numbered badge lives
 * inside an item and is the worked example for this pattern.
 */
export const NB_PARTS = [
  'heading',
  'body',
  'media',
  'cta',
  'eyebrow',
  'badge',
  'link',
  'item',
  'item-heading',
  'item-body',
  'item-media',
] as const

export type NbPart = (typeof NB_PARTS)[number]

const PART_SET: ReadonlySet<string> = new Set(NB_PARTS)

/** True when `value` is a published part name. */
export function isNbPart(value: string): value is NbPart {
  return PART_SET.has(value)
}
