import type { ReactElement } from 'react'
import type { Atom, Gap, SectionRecipe } from './types'
import { RecipeAtom, type RecipeMediaDoc } from './atoms'
import type { BlockContext } from '@/blocks/index'

/**
 * Walks a parsed recipe and composes Task 2's atom renderers into a section
 * (Plan: recipe language, Task 3).
 *
 * Does NOT carry `data-scheme` or `sectionVars` on its own root — the
 * per-block wrapper in `src/blocks/index.tsx` owns both for every block,
 * including a recipe section. Emitting them here too would nest two
 * disagreeing schemes once `customSection` is registered and split the
 * published `[data-nb-block="x"][data-scheme="y"]` selector idiom across two
 * elements. Every spacing/layout class below comes from a lookup keyed on the
 * recipe's literal enum values — never built by interpolating a class name
 * from data, because Tailwind's static scanner cannot see a runtime string
 * and would silently emit no CSS for it in production.
 *
 * Only `{ kind: 'static' }` item sources are handled; anything else (product,
 * category — deferred to a later plan that wires up the storefront data
 * layer) renders zero items. `content` is untrusted merchant/CMS data: only
 * slot names the recipe itself declares are ever read from it.
 */

export type RecipeContent = { header?: Record<string, unknown>; items?: Record<string, unknown>[] }

const WIDTH_CLASSES: Record<SectionRecipe['container']['width'], string> = {
  full: 'max-w-full',
  wide: 'max-w-6xl',
  narrow: 'max-w-3xl',
}

const PADDING_CLASSES: Record<SectionRecipe['container']['padding'], string> = {
  tight: 'px-4 py-8 sm:px-6',
  normal: 'px-4 py-14 sm:px-6 lg:px-8',
  roomy: 'px-4 py-20 sm:px-6 lg:px-8 lg:py-24',
}

const ALIGN_CLASSES: Record<SectionRecipe['container']['align'], string> = {
  start: 'text-left items-start',
  center: 'text-center items-center',
}

const GAP_CLASSES: Record<Gap, string> = {
  tight: 'gap-3',
  normal: 'gap-6',
  roomy: 'gap-10',
}

const PATTERN_CLASSES: Record<'grid' | 'row' | 'stack', string> = {
  grid: 'grid',
  row: 'flex flex-row flex-wrap',
  stack: 'flex flex-col',
}

// Responsive column-count classes, one lookup per breakpoint. Each value is a
// complete literal Tailwind class already present in this source file, so it
// survives production purging regardless of which count is picked at runtime.
const MOBILE_COLS: Record<1 | 2 | 3 | 4, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

const TABLET_COLS: Record<1 | 2 | 3 | 4, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}

const DESKTOP_COLS: Record<1 | 2 | 3 | 4, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
}

/**
 * Clamps an arbitrary column count onto the 1-4 range the lookups cover.
 * Non-finite input (NaN, +/-Infinity) falls back to 1 — a single column
 * never breaks a layout — rather than indexing a lookup with a key it
 * doesn't have, which would silently concatenate the literal string
 * "undefined" into the className.
 */
function colCount(n: number): 1 | 2 | 3 | 4 {
  if (!Number.isFinite(n)) return 1
  const rounded = Math.round(n)
  if (rounded <= 1) return 1
  if (rounded >= 4) return 4
  return rounded as 2 | 3
}

function columnsClasses(columns: { mobile: number; tablet: number; desktop: number }): string {
  return [MOBILE_COLS[colCount(columns.mobile)], TABLET_COLS[colCount(columns.tablet)], DESKTOP_COLS[colCount(columns.desktop)]].join(
    ' ',
  )
}

export function RecipeSection({
  recipe,
  content,
  ctx: _ctx,
  media,
}: {
  recipe: SectionRecipe
  content: RecipeContent
  ctx: BlockContext
  /** Resolved Media documents for every `media`-slot id in the recipe, keyed by `String(id)`. See `RecipeAtom`. */
  media?: Map<string, RecipeMediaDoc>
}): ReactElement | null {
  // `parseHeader` can return `{}` when every one of a header's sub-slots was
  // dropped as malformed (see parse.ts) — that object is truthy, so `!!` alone
  // would treat a header with nothing usable in it as present and render an
  // empty padded <section> for no content. A header only counts as present
  // when it declares at least one slot.
  const hasHeader = !!recipe.header && Object.keys(recipe.header).length > 0
  const hasItems = !!recipe.items
  if (!hasHeader && !hasItems) return null

  const { container } = recipe

  const headerAtoms: Atom[] = []
  if (recipe.header?.eyebrow) {
    headerAtoms.push({ kind: 'eyebrow', slot: recipe.header.eyebrow })
  }
  if (recipe.header?.heading) {
    headerAtoms.push({ kind: 'heading', level: 2, size: 'lg', slot: recipe.header.heading })
  }
  if (recipe.header?.body) {
    headerAtoms.push({ kind: 'text', size: 'md', slot: recipe.header.body })
  }

  // Product/category sources are deferred (see file docblock) — render no
  // items for anything but a static source. `content` is untrusted merchant
  // data (see file docblock), so `content.items` being `{}`, a string, or a
  // number rather than an array is a real input, not a hypothetical — guard
  // with Array.isArray rather than assuming the shape. `source.count` (parsed
  // and clamped to 1-12 by parse.ts) bounds how many items actually render:
  // without slicing to it here, the parser's bound is decorative and a
  // content row with far more entries than the recipe declares renders all of
  // them, unbounded.
  const items =
    recipe.items?.source.kind === 'static' && Array.isArray(content.items)
      ? content.items.slice(0, recipe.items.source.count)
      : []

  const itemsWrapperClass = recipe.items
    ? [
        PATTERN_CLASSES[recipe.items.layout.pattern],
        recipe.items.layout.pattern === 'grid' ? columnsClasses(recipe.items.layout.columns) : '',
        GAP_CLASSES[recipe.items.layout.gap],
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  return (
    <section
      // No data-scheme and no sectionVars here on purpose. The wrapper in
      // src/blocks/index.tsx owns both for every block, and putting them here
      // too would nest two disagreeing schemes and split the published
      // [data-nb-block="x"][data-scheme="y"] pair across two elements.
      // `container.scheme` is still meaningful — it seeds the block's own
      // scheme field at placement (src/lib/seed-custom-section-scheme.ts).
      className={`mx-auto flex flex-col ${WIDTH_CLASSES[container.width]} ${PADDING_CLASSES[container.padding]} ${ALIGN_CLASSES[container.align]}`}
    >
      {headerAtoms.length > 0 && (
        <div className="mb-10 flex flex-col gap-3">
          {headerAtoms.map((atom, i) => (
            <RecipeAtom key={i} atom={atom} source={content.header} index={i} level="block" media={media} />
          ))}
        </div>
      )}
      {recipe.items && (
        <div className={itemsWrapperClass}>
          {items.map((item, i) => (
            <div key={i} data-nb-part="item">
              {recipe.items!.template.map((atom, ai) => (
                <RecipeAtom key={ai} atom={atom} source={item} index={i} level="item" media={media} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
