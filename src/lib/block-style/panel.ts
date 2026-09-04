// src/lib/block-style/panel.ts
import type { BlockStyle } from './vocabulary'

/** The nested-group keys of `BlockStyle` (`eyebrow`, `heading`, ...). */
export type StyleGroupKey = keyof BlockStyle

/**
 * Pure helpers for the admin Style panel (`BlockStyleField`): translating between
 * a `BlockStyle` object and the individual control values a `<select>` renders,
 * and between the page-level style map and one block's entry in it. Kept free of
 * React/Payload so the read/write logic is unit-testable without a form context —
 * the component (Task 6 Step 2-3) is a thin wrapper that wires these to
 * `useField`/`useFormFields`.
 */

/** Reads one control's current value out of a block's style, or `undefined` if unset (renders as "Default"). */
export function getControlValue(style: BlockStyle, group: StyleGroupKey, control: string): string | undefined {
  const g = style[group] as Record<string, string | undefined> | undefined
  return g?.[control]
}

/**
 * Returns a new `BlockStyle` with one control set to `value`, or cleared when `value`
 * is `undefined`/`''` (the panel's "Default" option). A group left with no controls is
 * dropped entirely rather than persisted as `{}`, so an admin who sets then un-sets
 * every control in a group ends up with the same style object as never having touched
 * it — no `varsForStyle` divergence between "empty group" and "absent group" (there
 * isn't one today, but this keeps the persisted shape minimal regardless). Pure: never
 * mutates `style`.
 */
export function setControlValue(
  style: BlockStyle,
  group: StyleGroupKey,
  control: string,
  value: string | undefined,
): BlockStyle {
  const currentGroup: Record<string, string | undefined> = { ...(style[group] as Record<string, string | undefined> | undefined) }
  if (value === undefined || value === '') {
    delete currentGroup[control]
  } else {
    currentGroup[control] = value
  }

  const next: BlockStyle = { ...style }
  if (Object.keys(currentGroup).length > 0) {
    next[group] = currentGroup as never
  } else {
    delete next[group]
  }
  return next
}

/**
 * Narrows the page-level `blockStyles` json value (untyped Payload json column —
 * see `asStyleMap` in `src/blocks/index.tsx`, which this mirrors) down to a style
 * map. Any non-object/array/malformed value contributes an empty map rather than
 * throwing, matching the resolver's "absent key → no vars" contract — the admin
 * panel should never crash on a page saved before this field existed (value is
 * `null`) or on a hand-edited/corrupt json blob.
 */
export function asBlockStyleMap(value: unknown): Record<string, BlockStyle> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, BlockStyle>
}

/**
 * Returns a new page-level style map with `blockId`'s entry replaced by `style`,
 * or removed entirely when `style` has no groups left (keeps `blockStyles` free of
 * empty-object cruft for blocks an admin touched and then reset to all-default).
 * Pure: never mutates `map`.
 */
export function setBlockStyleInMap(
  map: Record<string, BlockStyle>,
  blockId: string,
  style: BlockStyle,
): Record<string, BlockStyle> {
  const next = { ...map }
  if (Object.keys(style).length > 0) {
    next[blockId] = style
  } else {
    delete next[blockId]
  }
  return next
}

/**
 * Block types offered in Store Settings' "Block style defaults" panel (Task 7)
 * — deliberately NOT every registry block. Store-wide defaults are a layer of
 * `resolveBlockStyle`'s merge; a block type with no var-consuming markup would
 * be phantom UI (the guardrail in the design doc §8: "only ship a control once
 * it is wired into ≥1 block and tested"). `hero` is the first block that reads
 * `--bs-*` vars; `productGrid` joined in Task 2 of Phase 3a, `categoryPreviews`
 * in Task 3, `ctaBanner` in Task 4, and `richText` (section width/padding only —
 * its heading styling stays in the global `.store-prose` CSS) in Task 5.
 * `contact`, `featuredProduct`, `videoEmbed`, and `newsletterSignup` (heading +
 * section only — it has no `data-nb-part="body"`) joined in Phase 3b's block
 * coverage batch 1. `promoSection`, `storyStats`, `faq`, and `featureGrid`
 * joined in batch 2 — `featureGrid` wires section-level parts only;
 * `storyStats` wires eyebrow/heading/media/section, and `faq` wires
 * heading/section. Across all three, item-level parts (item-heading/
 * item-body/item-media) are not yet in the vocabulary's scope.
 * `incentives`, `reviews`, `steps`, and
 * `testimonials` joined in batch 3, also section-level only — their tiles/
 * cards/rows (item-heading/item-body/item-media/badge) stay unwired.
 * `logoStrip`, `imageGallery`, and `ticker` joined in batch 4 (the last
 * batch), each section-level only: `logoStrip` wires its optional heading
 * plus section pad/width across all four layout variants, `imageGallery`
 * wires section padding only (no heading and no width container), and
 * `ticker` wires section pad (both variants) plus width (static variant
 * only) — their logos/images/phrases stay item-level and unwired. `spacer`
 * was assessed and deliberately NOT registered: its height comes from a
 * dedicated `size` field mapped to an inline style, not a `py-*`/section-pad
 * class, so there is nothing in the vocabulary for it to consume.
 * Add an entry here the same commit a block adopts the vocabulary — the
 * admin panel iterates this list, so growing it is the only change needed;
 * no new component code. Each entry's `parts` names exactly the groups that
 * block's markup reads (see `styleGroupsFor` below) — `panel.test.ts` re-runs
 * `scanBlockStyleParts` against `src/blocks` and fails the suite if a `parts`
 * array drifts from what the block actually consumes, in either direction.
 */
export const STYLABLE_BLOCK_TYPES: { value: string; label: string; parts: StyleGroupKey[] }[] = [
  { value: 'hero', label: 'Hero', parts: ['accent', 'eyebrow', 'heading', 'media', 'section', 'subheading'] },
  { value: 'productGrid', label: 'Product Grid', parts: ['eyebrow', 'heading', 'section'] },
  { value: 'categoryPreviews', label: 'Categories', parts: ['heading', 'section'] },
  { value: 'ctaBanner', label: 'CTA Banner', parts: ['heading', 'section', 'subheading'] },
  { value: 'richText', label: 'Rich Text', parts: ['section'] },
  { value: 'contact', label: 'Contact', parts: ['media', 'section', 'subheading'] },
  { value: 'featuredProduct', label: 'Featured Product', parts: ['heading', 'section', 'subheading'] },
  { value: 'videoEmbed', label: 'Video Embed', parts: ['heading', 'media', 'section', 'subheading'] },
  { value: 'newsletterSignup', label: 'Newsletter', parts: ['heading', 'section'] },
  { value: 'promoSection', label: 'Promo Section', parts: ['eyebrow', 'heading', 'media', 'section', 'subheading'] },
  { value: 'storyStats', label: 'Story + Stats', parts: ['eyebrow', 'heading', 'media', 'section'] },
  { value: 'faq', label: 'FAQ', parts: ['heading', 'section'] },
  { value: 'featureGrid', label: 'Feature Grid', parts: ['section'] },
  { value: 'incentives', label: 'Incentives', parts: ['section'] },
  { value: 'reviews', label: 'Reviews', parts: ['heading', 'section'] },
  { value: 'steps', label: 'Steps', parts: ['heading', 'section'] },
  { value: 'testimonials', label: 'Testimonials', parts: ['heading', 'section'] },
  { value: 'logoStrip', label: 'Logo Strip', parts: ['section'] },
  { value: 'imageGallery', label: 'Image Gallery', parts: ['section'] },
  { value: 'ticker', label: 'Ticker', parts: ['section'] },
]

/**
 * The vocabulary groups whose controls this block can actually respond to.
 *
 * `AllStyleGroups` used to render all six for every block, so a LogoStrip
 * offered seven eyebrow controls it has no eyebrow for — changing one was a
 * silent no-op, the worst failure mode a control has. On the median block 20 of
 * the 28 controls were inert.
 */
export function styleGroupsFor(blockType: string | undefined): StyleGroupKey[] {
  if (!blockType) return []
  return STYLABLE_BLOCK_TYPES.find((b) => b.value === blockType)?.parts ?? []
}
