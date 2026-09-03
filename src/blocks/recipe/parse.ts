import type { Atom, Gap, SectionRecipe, SlotRef } from './types'

type Items = NonNullable<SectionRecipe['items']>
type ItemsSource = Items['source']
type ItemsLayout = Items['layout']

/**
 * Merchant-authored section recipe: the single validation choke point.
 *
 * Mirrors src/lib/custom-css.ts — keep what is valid, drop what is not, cap
 * the size so a direct API write cannot bloat the row. `parseRecipe` is the
 * only way untrusted JSON (a page-builder field, an MCP write, a direct DB
 * edit) becomes a `SectionRecipe` a renderer can trust without re-checking.
 *
 * The throw/drop split is deliberate and asymmetric on purpose:
 *
 * - **Throw `RecipeError`** when the section as a whole would be meaningless:
 *   the input isn't an object, the `version` isn't one this parser knows,
 *   a *container* field is missing or outside its enum (the container is the
 *   one thing every section has, so a broken one leaves nothing to render),
 *   an atom is missing a slot it requires (a slot is a hole the instance form
 *   depends on — silently omitting it would mean the form has no field for
 *   content that's supposed to exist), or the payload exceeds
 *   `MAX_RECIPE_BYTES`.
 * - **Drop** an unknown top-level/container key, an unrecognised atom `kind`,
 *   or an atom whose own enum field is out of vocabulary. In every one of
 *   these cases the rest of the section is still coherent — one bad atom
 *   among many, or a stray key next to otherwise-valid ones — so silent
 *   removal is right for something the merchant could not have meant.
 * - **Clamp** a number that is merely out of range (columns to 1–4) instead
 *   of rejecting it outright: the intent ("some columns") is clear even when
 *   the exact figure is not.
 *
 * This file covers a deliberately small slice of the full recipe vocabulary:
 * the `richText`, `video`, `rating`, and `price` atoms; container
 * `background`/`minHeight`; `header.media`; `header.cta`; `masonry`; and
 * product/category item sources are all in the spec but NOT here — each needs
 * either the storefront data layer or a media/lexical dependency this task
 * does not wire up. A later plan adds them; this parser does not stub or
 * anticipate them.
 */

export const MAX_RECIPE_BYTES = 8 * 1024

export class RecipeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Type-guard membership test against a literal-tuple vocabulary. */
function isOneOf<T extends readonly unknown[]>(value: unknown, options: T): value is T[number] {
  return (options as readonly unknown[]).includes(value)
}

/** A number merely out of range is clamped, never rejected — see module docblock. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * Slot names are form field identity in the authoring UI and object keys in
 * stored content. Restricting the grammar forecloses the prototype-key class
 * outright — a recipe declaring a slot named `__proto__` made the content
 * cleaner replace its own object's prototype in plan 2 — and guarantees the
 * form a name it can use as a React key and an input id without escaping.
 */
const SLOT_NAME = /^[a-z][a-zA-Z0-9]*$/

/**
 * A slot is either a well-formed `{ name, label }` pair or nothing — there is
 * no partial slot. Callers that require one throw when this returns
 * undefined; callers for which a slot is optional just omit the field.
 *
 * This does not touch cross-recipe or cross-template uniqueness of names —
 * that is `assertUniqueSlotNames`, below, which runs once over the fully
 * assembled recipe.
 */
function parseSlot(raw: unknown): SlotRef | undefined {
  if (!isRecord(raw)) return undefined
  if (typeof raw.name !== 'string' || typeof raw.label !== 'string') return undefined
  if (!SLOT_NAME.test(raw.name)) return undefined
  return { name: raw.name, label: raw.label }
}

const CONTAINER_WIDTHS = ['full', 'wide', 'narrow'] as const
const CONTAINER_PADDINGS = ['tight', 'normal', 'roomy'] as const
const CONTAINER_SCHEMES = ['default', 'muted', 'inverse', 'accent'] as const
const CONTAINER_ALIGNS = ['start', 'center'] as const

/**
 * The container is the one part of a recipe every section has. Any field
 * missing or outside its enum makes the whole section meaningless, so this
 * throws rather than drops or defaults — unlike every other validator below.
 */
function parseContainer(raw: unknown): SectionRecipe['container'] {
  if (!isRecord(raw)) throw new RecipeError('recipe.container must be an object')

  if (!isOneOf(raw.width, CONTAINER_WIDTHS)) {
    throw new RecipeError(`recipe.container.width is not one of ${CONTAINER_WIDTHS.join(', ')}`)
  }
  if (!isOneOf(raw.padding, CONTAINER_PADDINGS)) {
    throw new RecipeError(`recipe.container.padding is not one of ${CONTAINER_PADDINGS.join(', ')}`)
  }
  if (!isOneOf(raw.scheme, CONTAINER_SCHEMES)) {
    throw new RecipeError(`recipe.container.scheme is not one of ${CONTAINER_SCHEMES.join(', ')}`)
  }
  if (!isOneOf(raw.align, CONTAINER_ALIGNS)) {
    throw new RecipeError(`recipe.container.align is not one of ${CONTAINER_ALIGNS.join(', ')}`)
  }

  // Rebuilding from named fields, rather than spreading `raw`, is what drops
  // an unknown key (e.g. a stray `boxShadow`) instead of persisting it.
  return { width: raw.width, padding: raw.padding, scheme: raw.scheme, align: raw.align }
}

/**
 * Every field is optional and decorative (eyebrow/heading/body copy above the
 * items grid). A malformed header, or one malformed slot within it, still
 * leaves a renderable section — the container and items stand on their own —
 * so this drops rather than throws, field by field.
 */
function parseHeader(raw: unknown): SectionRecipe['header'] {
  if (!isRecord(raw)) return undefined

  const header: NonNullable<SectionRecipe['header']> = {}
  const eyebrow = parseSlot(raw.eyebrow)
  const heading = parseSlot(raw.heading)
  const body = parseSlot(raw.body)
  if (eyebrow) header.eyebrow = eyebrow
  if (heading) header.heading = heading
  if (body) header.body = body
  return header
}

// `count` bounds the authoring form: it's how many static item slots a
// merchant is offered to fill by hand. 12 is already a 4x3 grid (the max
// `columns.desktop` of 4, three rows deep) — past that, a merchant wants a
// product source, not hand-entered slots. See task-1 review finding 2.
const MIN_STATIC_ITEM_COUNT = 1
const MAX_STATIC_ITEM_COUNT = 12

/**
 * `static` is the only source kind this task wires up (product/category
 * sources are deferred — see module docblock). A source this parser doesn't
 * recognise leaves nothing to iterate the template over, so the whole
 * `items` block is dropped rather than kept half-formed — the container (and
 * any header) still render on their own. `count` is merely out of range, so
 * it clamps rather than dropping anything (see the bounds above).
 */
function parseSource(raw: unknown): ItemsSource | undefined {
  if (!isRecord(raw)) return undefined
  if (raw.kind !== 'static') return undefined
  return {
    kind: 'static',
    count: clampInt(raw.count, MIN_STATIC_ITEM_COUNT, MAX_STATIC_ITEM_COUNT, MIN_STATIC_ITEM_COUNT),
  }
}

const LAYOUT_PATTERNS = ['grid', 'row', 'stack'] as const
const GAPS: readonly Gap[] = ['tight', 'normal', 'roomy']

/**
 * `pattern` and `gap` are both enums nested in the same `layout` object, and
 * both get the same treatment for the same reason: an unrecognised value in
 * either one is out-of-vocabulary, not merely out of range, so it drops the
 * whole `items` block rather than being coerced to a default — a categorical
 * fault is not what "clamp" in the module docblock means (that's reserved for
 * `columns`, a true numeric range). See task-1 review finding 1.
 */
function parseLayout(raw: unknown): ItemsLayout | undefined {
  if (!isRecord(raw)) return undefined
  if (!isOneOf(raw.pattern, LAYOUT_PATTERNS)) return undefined
  if (!isOneOf(raw.gap, GAPS)) return undefined

  const columnsRaw = isRecord(raw.columns) ? raw.columns : {}
  const columns = {
    mobile: clampInt(columnsRaw.mobile, 1, 4, 1),
    tablet: clampInt(columnsRaw.tablet, 1, 4, 1),
    desktop: clampInt(columnsRaw.desktop, 1, 4, 1),
  }
  return { pattern: raw.pattern, columns, gap: raw.gap }
}

const ASPECTS = ['1:1', '4:5', '3:2', '16:9'] as const
const FITS = ['cover', 'contain'] as const
const LEVELS = [2, 3, 4] as const
const SIZES = ['sm', 'md', 'lg'] as const
const BADGE_SOURCES = ['index', 'slot'] as const
const BUTTON_STYLES = ['primary', 'ghost'] as const

/**
 * One template atom. `null` means "drop this atom, keep the rest" — the
 * result for an unrecognised `kind` or an out-of-vocabulary enum on an
 * otherwise-known atom, since one bad element among many still leaves a
 * coherent section. A `RecipeError` throw means the opposite: the atom's
 * `kind` and enums are fine, but a slot it requires is missing or malformed,
 * so the instance form would silently lack a field for content the recipe
 * claims to need. Enum checks run before the slot check on every atom, so an
 * atom that is *both* out-of-vocabulary and missing its slot is dropped, not
 * thrown — the drop path only needs one reason.
 */
function parseAtom(raw: unknown): Atom | null {
  if (!isRecord(raw)) return null

  switch (raw.kind) {
    case 'media': {
      if (!isOneOf(raw.aspect, ASPECTS) || !isOneOf(raw.fit, FITS)) return null
      const slot = parseSlot(raw.slot)
      return slot ? { kind: 'media', aspect: raw.aspect, fit: raw.fit, slot } : { kind: 'media', aspect: raw.aspect, fit: raw.fit }
    }
    case 'icon': {
      const slot = parseSlot(raw.slot)
      if (!slot) throw new RecipeError('atom "icon" is missing its required slot')
      return { kind: 'icon', slot }
    }
    case 'heading': {
      if (!isOneOf(raw.level, LEVELS) || !isOneOf(raw.size, SIZES)) return null
      const slot = parseSlot(raw.slot)
      if (!slot) throw new RecipeError('atom "heading" is missing its required slot')
      return { kind: 'heading', level: raw.level, size: raw.size, slot }
    }
    case 'text': {
      if (!isOneOf(raw.size, SIZES)) return null
      const slot = parseSlot(raw.slot)
      if (!slot) throw new RecipeError('atom "text" is missing its required slot')
      return { kind: 'text', size: raw.size, slot }
    }
    case 'eyebrow': {
      const slot = parseSlot(raw.slot)
      if (!slot) throw new RecipeError('atom "eyebrow" is missing its required slot')
      return { kind: 'eyebrow', slot }
    }
    case 'badge': {
      if (!isOneOf(raw.source, BADGE_SOURCES)) return null
      const slot = parseSlot(raw.slot)
      return slot ? { kind: 'badge', source: raw.source, slot } : { kind: 'badge', source: raw.source }
    }
    case 'link': {
      const slot = parseSlot(raw.slot)
      if (!slot) throw new RecipeError('atom "link" is missing its required slot')
      const hrefSlot = parseSlot(raw.hrefSlot)
      if (!hrefSlot) throw new RecipeError('atom "link" is missing its required hrefSlot')
      return { kind: 'link', slot, hrefSlot }
    }
    case 'button': {
      if (!isOneOf(raw.style, BUTTON_STYLES)) return null
      const slot = parseSlot(raw.slot)
      if (!slot) throw new RecipeError('atom "button" is missing its required slot')
      const hrefSlot = parseSlot(raw.hrefSlot)
      if (!hrefSlot) throw new RecipeError('atom "button" is missing its required hrefSlot')
      return { kind: 'button', style: raw.style, slot, hrefSlot }
    }
    default:
      // Unrecognised kind — could not have been what the merchant meant.
      return null
  }
}

/**
 * `items` is optional wholesale: a section can be container + header only.
 * If present, a broken `source`, `layout`, or non-array `template` means
 * there is nothing coherent to iterate, so the whole block is dropped rather
 * than kept half-built — the container/header still render without it. Each
 * template atom is then parsed independently via `parseAtom`.
 */
function parseItems(raw: unknown): SectionRecipe['items'] {
  if (!isRecord(raw)) return undefined

  const source = parseSource(raw.source)
  if (!source) return undefined

  const layout = parseLayout(raw.layout)
  if (!layout) return undefined

  if (!Array.isArray(raw.template)) return undefined

  const template: Atom[] = []
  for (const atomRaw of raw.template) {
    const atom = parseAtom(atomRaw)
    if (atom) template.push(atom)
  }

  return { source, layout, template }
}

/**
 * Every SlotRef an atom declares. A seam from Task 1: `link` and `button` each
 * declare two (`slot` and `hrefSlot`), and the uniqueness walk below picks
 * both up without needing to change.
 */
function slotsOfAtom(atom: Atom): (SlotRef | undefined)[] {
  if (atom.kind === 'link' || atom.kind === 'button') return [atom.slot, atom.hrefSlot]
  return [atom.slot]
}

/**
 * A slot name may be declared once per recipe. Two atoms sharing a name would
 * render one generated form field feeding both, and the second silently wins
 * in stored content — invisible until a merchant wonders why two fields move
 * together.
 */
function assertUniqueSlotNames(recipe: SectionRecipe): void {
  const seen = new Set<string>()
  const claim = (ref: SlotRef | undefined) => {
    if (!ref) return
    if (seen.has(ref.name)) {
      throw new RecipeError(`slot name "${ref.name}" is declared more than once`)
    }
    seen.add(ref.name)
  }

  const header = recipe.header
  if (header) {
    claim(header.eyebrow)
    claim(header.heading)
    claim(header.body)
  }
  for (const atom of recipe.items?.template ?? []) {
    for (const ref of slotsOfAtom(atom)) claim(ref)
  }
}

/**
 * Validate and type untrusted JSON as a `SectionRecipe`. Throws `RecipeError`
 * for the cases that leave the section meaningless (see module docblock);
 * everything else is dropped, clamped, or defaulted so the rest of a
 * section still renders.
 */
export function parseRecipe(raw: unknown): SectionRecipe {
  if (!isRecord(raw)) {
    throw new RecipeError('recipe must be an object')
  }

  // `TextEncoder` rather than `Buffer.byteLength`: byte-identical for UTF-8,
  // but `Buffer` is a Node global with no browser polyfill in this project,
  // and this parser now runs in the admin content form's client bundle too
  // (src/components/admin/RecipeContentField.tsx), not just on the server.
  if (new TextEncoder().encode(JSON.stringify(raw)).length > MAX_RECIPE_BYTES) {
    throw new RecipeError(`recipe is larger than the ${Math.floor(MAX_RECIPE_BYTES / 1024)}KB limit`)
  }

  if (raw.version !== 1) {
    throw new RecipeError(`unsupported recipe version: ${JSON.stringify(raw.version)}`)
  }

  const container = parseContainer(raw.container)
  const header = parseHeader(raw.header)
  const items = parseItems(raw.items)

  const recipe: SectionRecipe = { version: 1, container }
  if (header) recipe.header = header
  if (items) recipe.items = items
  assertUniqueSlotNames(recipe)
  return recipe
}
