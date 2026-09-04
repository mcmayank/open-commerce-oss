//
// Which block field, if any, a double-clicked element on the canvas edits.
//
// Pure and isomorphic — no DOM, no React. The preview frame supplies the
// `data-nb-part` it found and the text it is showing; the builder supplies that
// block's current field values from form state. Nothing here reads the document.
//
// Why part + text rather than a `data-nb-field` attribute on every block: the
// `data-nb-part` hooks ALREADY exist across all 19 text-bearing blocks as part
// of the published `nb-hooks/1` theming contract (docs/THEMING-HOOKS.md), and
// adding a second, parallel marker to ~27 JSX elements would be a new contract
// to keep in sync for no extra information. The part narrows the candidates;
// the text-equality check below is what actually pins the field.
//
// That equality check is a refusal, not a formality. A block file can contain
// several `data-nb-part="heading"` elements (Hero has four, one per variant) and
// the part vocabulary is coarser than the field names — `body` covers a Hero
// subheading, a Contact address and a VideoEmbed caption. If the visible text is
// not exactly the candidate's current value, we are on the wrong node and must
// decline rather than write to a field the merchant was not pointing at.

/**
 * `data-nb-part` value -> the block field names it may edit, in no significant
 * order (ambiguity is refused, not ranked).
 *
 * Deliberately partial. Parts absent from this map are not editable in Round 2:
 * `media` and `link` are not plain text, `badge` is derived, and every `item-*`
 * part addresses an array row, which the spec puts out of scope.
 */
export const PART_FIELD_CANDIDATES: Record<string, readonly string[]> = {
  heading: ['heading'],
  eyebrow: ['eyebrow'],
  // `body` names two different fields depending on the block: Hero, MediaHero
  // and SplitHero call their sub-text `subheading`, while CTABanner,
  // PromoSection and StoryStats call theirs `body`. Listing only `subheading`
  // left those three blocks' sub-text inert on the canvas. Listing both is safe
  // for the same reason the map is candidate-based at all: the text-equality
  // check below still refuses unless exactly ONE of them holds the clicked text,
  // and no block declares both fields.
  body: ['subheading', 'body'],
  cta: ['primaryCtaLabel', 'secondaryCtaLabel', 'ctaLabel', 'buttonLabel'],
}

/**
 * The single field the clicked element edits, or `null` when that cannot be
 * established beyond doubt.
 *
 * Returns null for: an unmapped part, no candidate whose current value equals
 * `text`, or more than one such candidate.
 */
export function resolveEditField(
  part: string,
  text: string,
  values: Record<string, unknown>,
): string | null {
  const candidates = PART_FIELD_CANDIDATES[part]
  if (!candidates) return null

  const needle = text.trim()
  const matches = candidates.filter((field) => {
    const value = values[field]
    return typeof value === 'string' && value.trim() === needle
  })

  return matches.length === 1 ? matches[0] : null
}

/**
 * The form-state path of a layout row itself.
 *
 * This is the `parentPath` `BlockContentEditor` hands `RenderFields`, and the
 * prefix `fieldPath` below builds on. It exists as its own export so that
 * spelling lives in exactly ONE place: previously the inspector wrote
 * `layout.${idx}` inline and `fieldPath` wrote the same formula again, and a
 * test comparing two hand-written copies of one formula cannot catch drift
 * between them — both copies have to be edited to stay wrong together. With
 * both surfaces composing this function, drift is impossible by construction
 * rather than merely asserted.
 */
export function blockRowPath(rowIndex: number): string {
  return `layout.${rowIndex}`
}

/**
 * The form-state path for a field on a layout row.
 *
 * Spelled here once and imported by both surfaces. `BlockContentEditor` hands
 * `RenderFields` a `parentPath` of `blockRowPath(rowIndex)` and Payload appends
 * `.<fieldName>`; the canvas editor passes this string to `useField`. Same
 * string, therefore same form-state entry, therefore one write path — which is
 * the invariant the spec's risk section calls the highest-consequence one.
 */
export function fieldPath(rowIndex: number, field: string): string {
  return `${blockRowPath(rowIndex)}.${field}`
}
