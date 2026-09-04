'use client'

import * as React from 'react'
import type { Block } from 'payload'
import { useForm, useFormFields } from '@payloadcms/ui'
import { PAGE_BLOCKS } from '@/blocks/registry'
import { summarizeBlocks, blockAvailable, type BlockEntitlements } from '@/mcp/blocks'
import { usePremiumEntitlement } from '../PremiumEntitlement/PremiumEntitlementClient'
import { useSelection } from './selection'

type Row = { id: string; blockType?: string }

/**
 * Curated grouping for the add-block library. A block missing from this map
 * (a new block shipped without updating it) falls to "Utility" rather than
 * disappearing from the picker — see `categoryFor`.
 */
const CATEGORY_ORDER = ['Heroes', 'Commerce', 'Content', 'Social proof', 'Media & capture', 'Utility'] as const
type Category = (typeof CATEGORY_ORDER)[number]

const CATEGORY_BY_SLUG: Record<string, Category> = {
  hero: 'Heroes',
  splitHero: 'Heroes',
  mediaHero: 'Heroes',

  productGrid: 'Commerce',
  featuredProduct: 'Commerce',
  categoryPreviews: 'Commerce',
  incentives: 'Commerce',

  richText: 'Content',
  faq: 'Content',
  steps: 'Content',
  featureGrid: 'Content',
  storyStats: 'Content',
  contact: 'Content',
  ctaBanner: 'Content',
  promoSection: 'Content',

  testimonials: 'Social proof',
  reviews: 'Social proof',
  logoStrip: 'Social proof',

  imageGallery: 'Media & capture',
  videoEmbed: 'Media & capture',
  newsletterSignup: 'Media & capture',
  ticker: 'Media & capture',

  spacer: 'Utility',
  customSection: 'Utility',
}

function categoryFor(slug: string): Category {
  return CATEGORY_BY_SLUG[slug] ?? 'Utility'
}

/** Computed once at module load — PAGE_BLOCKS is a static registry, not per-render data. */
const GROUPED_BLOCKS: { category: Category; blocks: Block[] }[] = CATEGORY_ORDER.map((category) => ({
  category,
  blocks: PAGE_BLOCKS.filter((block) => categoryFor(block.slug) === category),
})).filter((group) => group.blocks.length > 0)

/** Exported so LayersRail.tsx (Task 8) can look up a block's entitlement gate
 *  without recomputing this map or importing `@/mcp/blocks` summarization logic
 *  a second time. */
export const BLOCK_SUMMARY_BY_SLUG = new Map(summarizeBlocks(PAGE_BLOCKS).map((summary) => [summary.slug, summary]))

/**
 * Whether the connected store's plan blocks this row's block type from saving,
 * so both the library (before you add it) and the layers rail (after it's on
 * the page — e.g. a downgrade happened since) show the exact same lock, from
 * the one entitlement source (`blockAvailable`, `@/mcp/blocks`) rather than a
 * second guess that could drift from it.
 */
export function isBlockLocked(blockType: string | undefined, entitlements: BlockEntitlements): boolean {
  if (!blockType) return false
  const summary = BLOCK_SUMMARY_BY_SLUG.get(blockType)
  return !summary || !blockAvailable(summary, entitlements)
}

/**
 * A handful of blocks predate the `labels` convention (hero, faq, richText,
 * productGrid, imageGallery, ctaBanner, testimonials, newsletterSignup) and
 * declare none, so their raw camelCase slug is the only name PAGE_BLOCKS
 * offers. Rather than showing that raw slug in the UI, humanize it — split on
 * the camelCase boundary and title-case each word, with a tiny override table
 * for initialisms plain title-casing would otherwise mangle (`faq` would
 * become `Faq`; the table keeps it `FAQ`).
 */
const ACRONYMS: Record<string, string> = { faq: 'FAQ', cta: 'CTA', seo: 'SEO' }

function humanizeSlug(slug: string): string {
  const words = slug
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
  return words
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Human label for a block type. Prefers the block's own `labels.singular`;
 * falls back to a humanized slug rather than the raw camelCase. Exported so
 * LayersRail.tsx shows the exact same name for a block as this library does —
 * one source, not two guesses that can drift apart.
 */
export function labelForBlockType(blockType: string | undefined): string {
  if (!blockType) return 'Block'
  const block = PAGE_BLOCKS.find((b) => b.slug === blockType)
  const label = block?.labels?.singular
  if (typeof label === 'string') return label
  return humanizeSlug(blockType)
}

function labelFor(block: Block): string {
  return labelForBlockType(block.slug)
}

/**
 * Add-block library — Task 7. Groups `PAGE_BLOCKS` into curated categories and
 * inserts a new `layout` row via Payload's own `addFieldRow`.
 *
 * THE SHARP EDGE: Payload's built-in Blocks field
 * (`node_modules/@payloadcms/ui/dist/fields/Blocks/index.js`, `addRow`) does
 * NOT pre-build the new row's sub-field state before calling `addFieldRow`.
 * It calls `addFieldRow({ blockType, path, rowIndex, schemaPath })` with no
 * `subFieldState`, and the `ADD_ROW` reducer (`forms/Form/fieldReducer.js`)
 * inserts a row with `{ id, blockType, isLoading: true }` and empty sub-field
 * state. Real, server-computed sub-field state (defaults, condensed
 * conditions, etc.) arrives afterwards via the surrounding `<Form>`'s
 * debounced `onChange` — which, on every modified-field tick, calls
 * `getFormState` (from `useServerFunctions()`) and merges the result back in
 * (`MERGE_SERVER_STATE`). That `onChange` is normally wired by Payload's
 * stock Edit view (`views/Edit/index.tsx`); this page builder renders its own
 * top-level `<Form>` (`PageBuilderView.tsx`) which didn't have one, so
 * `addFieldRow` alone would have left new rows permanently `isLoading` with
 * no hydrated fields. PageBuilderView.tsx now wires the same `onChange`
 * (mirroring the stock Edit view's call to `getFormState`), so calling
 * `addFieldRow` here reproduces the exact flow Payload's own "Add" uses, not
 * a hand-rolled substitute.
 *
 * Gating reuses `blockAvailable` (`src/mcp/blocks.ts`) — the same function
 * `list_blocks` uses for the MCP tool — rather than reimplementing the
 * premium/entitlement rules, so a block never drifts into "offered here,
 * refused at save" for one surface but not the other.
 *
 * `collectionSlug` — dropped in Task 8. `addFieldRow`'s own implementation
 * (`useForm()`'s, `node_modules/@payloadcms/ui/dist/forms/Form/index.js`)
 * destructures only `{ blockType, path, rowIndex, subFieldState }` — the
 * `ADD_ROW` reducer it dispatches to (`fieldReducer.js`) never reads
 * `schemaPath` either. The value this component built from `collectionSlug`
 * (`${collectionSlug}.layout`) was therefore inert from the day this file was
 * written, mirroring the stock Blocks field's own call shape rather than
 * anything `addFieldRow` itself needed. `schemaPath` is still a *required*
 * property on `addFieldRow`'s TypeScript signature, so the call below keeps
 * passing one — just a fixed placeholder (`'layout'`, the field's own path)
 * instead of a value built from `collectionSlug`. That removes this
 * component's only reason to call `useDocumentInfo()`, which matters for
 * Task 8: LayersRail.tsx renders this component inline as the gap-insertion
 * popover, and its test mocks `@payloadcms/ui` wholesale without
 * `useDocumentInfo` (it never needed it before this file started calling it).
 *
 * `rowIndex` prop — Task 8. LayersRail's insertion gaps already know exactly
 * which index a new block should land at (the gap the merchant clicked), so
 * when it's supplied it wins outright. Left absent, this keeps its original
 * behavior: insert after the selected row, or append at the end.
 */
export function BlockLibrary({ onAdd, rowIndex }: { onAdd?: () => void; rowIndex?: number } = {}) {
  const { addFieldRow } = useForm()
  const rows = (useFormFields(([fields]) => fields.layout?.rows) ?? []) as Row[]
  const { selectedId } = useSelection()
  const { premiumSections, customSections } = usePremiumEntitlement()

  const entitlements: BlockEntitlements = { premiumSections, customSections }

  const handleAdd = (slug: string) => {
    const summary = BLOCK_SUMMARY_BY_SLUG.get(slug)
    if (!summary || !blockAvailable(summary, entitlements)) return

    const insertAt =
      rowIndex ??
      (() => {
        const selectedIndex = rows.findIndex((row) => row.id === selectedId)
        return selectedIndex >= 0 ? selectedIndex + 1 : rows.length
      })()

    addFieldRow({
      path: 'layout',
      // Required by addFieldRow's type but not read by ADD_ROW at runtime
      // (see docblock above) — a fixed placeholder, not a value built from
      // `useDocumentInfo()`.
      schemaPath: 'layout',
      blockType: slug,
      rowIndex: insertAt,
    })
    onAdd?.()
  }

  return (
    <div className="nb-pb-library">
      {GROUPED_BLOCKS.map(({ category, blocks }) => (
        <section key={category} className="nb-pb-library__group">
          <h4 className="nb-pb-library__group-title">{category}</h4>
          <ul className="nb-pb-library__list">
            {blocks.map((block) => {
              const locked = isBlockLocked(block.slug, entitlements)
              return (
                <li key={block.slug}>
                  <button
                    type="button"
                    data-testid={`block-${block.slug}`}
                    className={`nb-pb-library__item${locked ? ' is-locked' : ''}`}
                    disabled={locked}
                    onClick={() => handleAdd(block.slug)}
                  >
                    <span className="nb-pb-library__item-label">{labelFor(block)}</span>
                    {locked ? (
                      <span className="nb-pb-library__lock" aria-label="Locked — upgrade required" title="Upgrade required">
                        &#128274;
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
