// Pure, isomorphic partition of a block's fields into "content" (what the page
// builder's Content tab authors) and everything the Style tab already owns.
// No React, no Payload runtime — imported by the inspector and tested directly,
// same discipline as src/lib/block-style/panel.ts.

/**
 * The three field names `BlockInspector` renders its own dedicated control
 * for, each with a fixed tab home: `scheme` (the band select) and
 * `blockStyle` (the legacy `type: 'ui'` mount point for the style panel) on
 * Style; `variant` (VariantPickerField) on Layout, alongside the fields in
 * `LAYOUT_FIELD_NAMES`.
 *
 * Named `DEDICATED_FIELD_NAMES` rather than `STYLE_TAB_FIELD_NAMES` — once
 * `variant` moved to the Layout tab (Task 6), the old name claimed all three
 * lived on one tab, which was no longer true and would have pointed the next
 * person at the wrong tab for a new dedicated control.
 *
 * Excluded from the Content tab so no control appears in both places. Keep in
 * sync with what `BlockInspector` actually renders — `content-fields.test.ts`
 * asserts the set, and the inspector's own tests assert the three tabs are
 * disjoint.
 */
export const DEDICATED_FIELD_NAMES = ['variant', 'scheme', 'blockStyle'] as const

/**
 * Layout knobs that belong on the Layout tab rather than among the words.
 *
 * The first version of this split defined Content as "everything the Style tab
 * does not already render", which is a rule about what happened to be
 * implemented, not about what the fields mean. Height and alignment ended up
 * between `overlay` and `primaryCtaLabel` in a tab of text inputs, where nobody
 * looking to resize a hero would think to check. They then spent a while on
 * the Style tab itself (Task 5) before Task 6 gave layout its own tab, so
 * "how much room it takes" isn't mixed in with "how it looks" either.
 *
 * Matched by NAME, so any block declaring one of these gets it on the Layout
 * tab without a second registration step — the same registry-derived rule the
 * rest of the builder follows.
 */
export const LAYOUT_FIELD_NAMES = [
  'mediaSide',
  'textAlign',
  'verticalAlign',
  'overlay',
  'minHeight',
] as const

type NamedField = { name?: string }

/** Structural shape of the container fields the walk below descends through. */
type WalkableField = {
  name?: string
  type?: string
  fields?: unknown[]
  tabs?: { fields?: unknown[] }[]
  blocks?: unknown[]
}

/**
 * The block definitions declared by the `blocks` field called `fieldName`,
 * searched depth-first through presentational containers.
 *
 * Needed because `config.blocksMap` only holds blocks registered at the ROOT of
 * the Payload config (`config.blocks` — see payload/dist/config/client.js), and
 * `PAGE_BLOCKS` are declared inline on `Pages.layout` instead. So the map is
 * empty at runtime and the block definitions have to be read off the field
 * itself. `Pages.layout` additionally sits inside an unnamed `tabs` field, hence
 * the recursion rather than a flat `.find`.
 *
 * Returns `[]` rather than throwing when the field is absent, so a config change
 * degrades to an empty Content tab instead of a crashed admin.
 */
export function findBlockDefinitions<B extends { slug: string }>(
  fields: readonly unknown[] | undefined,
  fieldName: string,
): B[] {
  if (!Array.isArray(fields)) return []

  for (const raw of fields) {
    if (typeof raw !== 'object' || raw === null) continue
    const field = raw as WalkableField

    if (field.type === 'blocks' && field.name === fieldName) {
      return Array.isArray(field.blocks) ? (field.blocks as B[]) : []
    }

    // Unnamed presentational containers (tabs / row / collapsible) and named
    // groups both nest their children, so the target can be at any depth.
    if (Array.isArray(field.tabs)) {
      for (const tab of field.tabs) {
        const found = findBlockDefinitions<B>(tab?.fields, fieldName)
        if (found.length) return found
      }
    }
    if (Array.isArray(field.fields)) {
      const found = findBlockDefinitions<B>(field.fields, fieldName)
      if (found.length) return found
    }
  }

  return []
}

/**
 * The authorable fields of `blockType`, in declaration order.
 *
 * Takes the block list as an argument rather than importing `PAGE_BLOCKS`
 * directly so the admin can pass Payload's *client* block configs (which carry
 * the server-rendered custom components) while tests pass the server registry.
 *
 * Unknown block type — a selection and form-state momentarily out of sync, or a
 * row whose `blockType` hasn't hydrated yet — yields `[]` rather than throwing,
 * mirroring how `BlockInspector` already degrades on a missing row.
 */
export function contentFieldsFor<F = NamedField>(
  blocks: readonly unknown[] | undefined,
  blockType: string | undefined,
): F[] {
  if (!blockType || !Array.isArray(blocks)) return []

  // Structural narrowing rather than Payload's `Block` / `ClientBlock` types:
  // this module is called with BOTH (server registry in tests, client config in
  // the admin), and `Field` is a union whose container members have no `name`
  // at all — which TypeScript's weak-type check rejects against a `{ name?: }`
  // parameter. Narrowing here keeps one implementation for both callers.
  const block = (blocks as { slug?: string }[]).find((b) => b?.slug === blockType)
  const fields = (block as { fields?: unknown[] } | undefined)?.fields
  if (!Array.isArray(fields)) return []

  return (fields as NamedField[]).filter(
    (field) =>
      !DEDICATED_FIELD_NAMES.some((excluded) => excluded === field?.name) &&
      !LAYOUT_FIELD_NAMES.some((excluded) => excluded === field?.name),
  ) as F[]
}

/**
 * The layout knobs of `blockType`, in declaration order — the Layout tab's
 * counterpart to `contentFieldsFor`. Together with the three fields that have
 * their own dedicated controls, the three lists cover everything a block
 * declares and never overlap; `content-fields.test.ts` asserts exactly that
 * for every block in the registry.
 */
export function layoutFieldsFor<F = NamedField>(
  blocks: readonly unknown[] | undefined,
  blockType: string | undefined,
): F[] {
  if (!blockType || !Array.isArray(blocks)) return []

  const block = (blocks as { slug?: string }[]).find((b) => b?.slug === blockType)
  const fields = (block as { fields?: unknown[] } | undefined)?.fields
  if (!Array.isArray(fields)) return []

  return (fields as NamedField[]).filter((field) =>
    LAYOUT_FIELD_NAMES.some((name) => name === field?.name),
  ) as F[]
}
