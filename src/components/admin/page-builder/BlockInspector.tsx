'use client'

import * as React from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import type { BlockStyle } from '@/lib/block-style/vocabulary'
import { varsForStyle, BLOCK_STYLE_VOCAB } from '@/lib/block-style/vocabulary'
import {
  asBlockStyleMap,
  setControlValue,
  setBlockStyleInMap,
  STYLABLE_BLOCK_TYPES,
  styleGroupsFor,
  type StyleGroupKey,
} from '@/lib/block-style/panel'
import { AllStyleGroups, type StyleChangeHandler } from '@/components/admin/StyleControlGroups'
import VariantPickerField from '@/components/admin/VariantPickerField'
import { PAGE_BLOCKS } from '@/blocks/registry'
import { useSelection } from './selection'
import { BlockContentEditor, BlockLayoutFields } from './BlockContentEditor'
import { useHoverPreview } from './useHoverPreview'

type Row = {
  id: string
  blockType?: string
}

type SchemeOption = { label: string; value: string }

function labelFor(blockType: string | undefined): string {
  const match = STYLABLE_BLOCK_TYPES.find((b) => b.value === blockType)
  return match?.label ?? blockType ?? 'Block'
}

/**
 * A block opts into scheme/variant editing purely by declaring the field in its
 * own config — same "derive from the registry" rule as everywhere else in the
 * builder, so a block gaining or losing one of these fields doesn't need a
 * second place updated.
 */
function findTopLevelField(blockType: string | undefined, name: string) {
  const block = PAGE_BLOCKS.find((b) => b.slug === blockType)
  return block?.fields?.find((f) => 'name' in f && f.name === name)
}

/** The `scheme` select's own options (Theme default / Default / Muted / Inverse / Accent), read off the block's field config rather than duplicated here. */
function schemeOptionsFor(blockType: string | undefined): SchemeOption[] | null {
  const field = findTopLevelField(blockType, 'scheme')
  if (!field || !('options' in field) || !Array.isArray(field.options)) return null
  return field.options.map((o) =>
    typeof o === 'string' ? { label: o, value: o } : { label: String(o.label ?? o.value), value: String(o.value) },
  )
}

function hasVariantField(blockType: string | undefined): boolean {
  return !!findTopLevelField(blockType, 'variant')
}

/** A group's control count, read off the vocabulary itself — never a hand-kept number, so it can't drift as `BLOCK_STYLE_VOCAB` grows. */
function groupControlCount(group: StyleGroupKey): number {
  return Object.keys(BLOCK_STYLE_VOCAB[group]).length
}

/** Total controls across all six vocabulary groups (28 today) — computed, not hardcoded, so a future control addition updates this for free. */
const TOTAL_STYLE_CONTROLS = (Object.keys(BLOCK_STYLE_VOCAB) as StyleGroupKey[]).reduce(
  (sum, group) => sum + groupControlCount(group),
  0,
)

/**
 * How many of the vocabulary's controls this block type cannot use at all —
 * eyebrow/heading/subheading/accent/media/section groups it never reads
 * (`styleGroupsFor`), not merely groups absent from whichever inspector tab
 * happens to be open right now. Product Grid reads eyebrow, heading and
 * section (15 controls) so this is 13; Hero reads all six so this is 0.
 */
function hiddenControlCount(blockType: string | undefined): number {
  const liveControls = styleGroupsFor(blockType).reduce((sum, group) => sum + groupControlCount(group), 0)
  return TOTAL_STYLE_CONTROLS - liveControls
}

/**
 * The Style-tab note explaining why some (or, for a section-only block, all)
 * of the vocabulary's controls aren't visible here.
 *
 * `styleGroups` is the Style tab's own group list (i.e. `styleGroupsFor`
 * minus `section`, which lives on Layout — see the call site). When it's
 * non-empty, this block still shows some controls on the Style tab, so the
 * original "N aren't shown" framing reads fine. When it's EMPTY — every
 * group this block can use is `section`, entirely on the Layout tab — "N
 * aren't shown" would describe a tab the merchant can see rendering zero
 * controls, with no clue where the other 2 went. Naming the actual tab
 * fixes that; deriving both the shown-count and the tab mention from
 * `styleGroups`/`hiddenControls` keeps this correct as the vocabulary grows,
 * with no hand-kept numbers.
 */
function hiddenGroupsNote(
  blockType: string | undefined,
  styleGroups: StyleGroupKey[],
  hiddenControls: number,
): string {
  const shownControls = TOTAL_STYLE_CONTROLS - hiddenControls
  const label = labelFor(blockType)
  if (styleGroups.length === 0) {
    return `${label} only responds to ${shownControls} of the ${TOTAL_STYLE_CONTROLS} style controls, and those live on the Layout tab.`
  }
  return `${hiddenControls} of ${TOTAL_STYLE_CONTROLS} style controls aren't shown — ${label} has no matching part to style.`
}

/**
 * Right pane of the Phase 3b page builder — Task 6. Renders the vocabulary
 * style controls (`AllStyleGroups`, shared with Task 7's store-wide
 * defaults panel) for the currently-selected block, and live-patches the
 * preview iframe as each control changes.
 *
 * Mirrors `BlockStyleField.tsx`'s read/write cycle exactly, but keyed off
 * `useSelection()`'s `selectedId` (this builder's own selection state)
 * rather than a block-scoped `path` prop: `blockStyles` is bound the same
 * way — an explicit `path` on `useField`, which binds to the page-level
 * field regardless of where this component is mounted in the tree — and a
 * block's `blockType` is read via `useFormFields` off the `layout` rows,
 * the same selector `LayersRail` uses.
 *
 * SCHEME editing: a block's `scheme` isn't one of the `--bs-*` vars `patch()`
 * pushes live — the storefront renders it via a wrapper `data-scheme`
 * attribute plus `--section-*` band vars, baked in at render time. It still
 * updates live, via a dedicated `scheme` bridge message (`setScheme`) that
 * PreviewBridge applies directly to the wrapper — see
 * src/app/(storefront)/store/[tenant]/components/PreviewBridge.tsx.
 *
 * VARIANT editing: a block's `variant` picks a structurally different
 * layout (different DOM, not a CSS var), so there's no live-patch path for
 * it. Changing it writes the field as normal and reloads the preview iframe
 * (`reload()`) so the new layout actually renders.
 */
export function BlockInspector({
  patch,
  setScheme,
  reload,
}: {
  patch: (blockId: string, vars: Record<string, string>) => void
  setScheme: (blockId: string, scheme: string) => void
  reload: () => void
}) {
  const { selectedId } = useSelection()
  const rows = (useFormFields(([fields]) => fields.layout?.rows) ?? []) as Row[]
  const idx = rows.findIndex((row) => row.id === selectedId)
  const blockType = idx >= 0 ? rows[idx]?.blockType : undefined

  const { value, setValue } = useField<Record<string, BlockStyle>>({ path: 'blockStyles' })
  const map = React.useMemo(() => asBlockStyleMap(value), [value])
  const thisStyle: BlockStyle = React.useMemo(() => (selectedId && map[selectedId]) || {}, [selectedId, map])

  const handleChange: StyleChangeHandler = React.useCallback(
    (group, control, val) => {
      if (!selectedId) return
      const next = setControlValue(thisStyle, group, control, val)
      const nextMap = setBlockStyleInMap(map, selectedId, next)
      setValue(nextMap)
      patch(selectedId, varsForStyle(next))
    },
    [selectedId, thisStyle, map, setValue, patch],
  )

  const { onPreview, onPreviewEnd } = useHoverPreview({ patch, blockId: selectedId, style: thisStyle })

  // `useField`/`useFormFields` are hooks — they must run on every render in
  // the same order, so these stay unconditional even before the `!selectedId`
  // early return below. When there's no matching row, `idx` is -1 and these
  // paths point at a field that doesn't exist; the hooks below all cope with
  // that (empty options, no subscription target) rather than throwing.
  const schemePath = idx >= 0 ? `layout.${idx}.scheme` : '__nb_no_scheme__'
  const schemeField = useField<string>({ path: schemePath })
  const schemeOptions = schemeOptionsFor(blockType)

  const variantPath = idx >= 0 ? `layout.${idx}.variant` : ''
  const showVariant = hasVariantField(blockType)
  const variantValue = useFormFields(([fields]) =>
    variantPath ? (fields[variantPath] as { value?: unknown } | undefined)?.value : undefined,
  ) as string | undefined

  // Reload the preview when the *saved* variant value actually changes for
  // the *same* block — never on mount, and never merely because the admin
  // selected a different block (which also changes variantValue, but to that
  // other block's own current variant, not an edit).
  const prevVariantRef = React.useRef<{ key: string | null; value: string | undefined }>({
    key: null,
    value: undefined,
  })
  React.useEffect(() => {
    const key = showVariant && variantPath ? `${selectedId}:${variantPath}` : null
    const prev = prevVariantRef.current
    if (key && prev.key === key && prev.value !== undefined && prev.value !== variantValue) {
      reload()
    }
    prevVariantRef.current = { key, value: variantValue }
  }, [selectedId, variantPath, showVariant, variantValue, reload])

  // Content is the default tab: a block is added to be filled in, and after
  // clicking a different block in the outline or the preview the admin wants
  // that block's words, not the previous block's style panel.
  //
  // Reset during render rather than in an effect — React's documented way to
  // adjust state when a prop/derived value changes. An effect would paint the
  // previous block's Style tab for a frame before switching.
  const [tab, setTab] = React.useState<'content' | 'style' | 'layout'>('content')
  const [tabOwner, setTabOwner] = React.useState<string | null>(selectedId)
  if (tabOwner !== selectedId) {
    setTabOwner(selectedId)
    setTab('content')
  }

  const handleSchemeChange = React.useCallback(
    (nextScheme: string) => {
      if (!selectedId) return
      schemeField.setValue(nextScheme)
      setScheme(selectedId, nextScheme)
    },
    [selectedId, schemeField, setScheme],
  )

  if (!selectedId) {
    return (
      <div className="nb-pb-inspector">
        <p className="nb-pb-inspector__empty">Select a block to edit it.</p>
      </div>
    )
  }

  const isStylable = STYLABLE_BLOCK_TYPES.some((b) => b.value === blockType)
  const hiddenControls = hiddenControlCount(blockType)
  // `section` (density/width) moves to Layout, alongside height, alignment
  // and Variant — "how much room it takes" rather than "how it looks". Style
  // keeps `scheme` plus the remaining typography/accent/media groups.
  const styleGroups = styleGroupsFor(blockType).filter((g) => g !== 'section')
  const layoutGroups = styleGroupsFor(blockType).filter((g) => g === 'section')

  const styleTab = (
    <>
      {schemeOptions ? (
        <fieldset className="nb-pb-inspector__scheme" style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
          <legend
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '.05em',
              color: 'var(--theme-elevation-500)',
              marginBottom: 6,
              padding: 0,
            }}
          >
            Scheme
          </legend>
          <select
            aria-label="Scheme"
            value={schemeField.value ?? ''}
            onChange={(e) => handleSchemeChange(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-150)',
              background: 'var(--theme-input-bg, transparent)',
              color: 'var(--theme-text)',
            }}
          >
            {schemeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </fieldset>
      ) : null}

      {isStylable ? (
        <div className="nb-pb-inspector__groups">
          {/* storeStyle deliberately omitted: `blockStyleDefaults` lives on the
              store_settings global, a different document from the page this
              form is editing — useField can't reach across documents. The
              instance-vs-theme cascade still renders correctly; the "Store ·"
              origin label is a documented follow-up once cross-document reads
              are wired up (see task-4-report.md). */}
          <AllStyleGroups
            style={thisStyle}
            groups={styleGroups}
            scope="instance"
            blockType={blockType}
            onChange={handleChange}
            resetKey={selectedId}
            onPreview={onPreview}
            onPreviewEnd={onPreviewEnd}
          />
          {hiddenControls > 0 ? (
            <p className="nb-pb-inspector__note" data-testid="nb-hidden-groups-note">
              {hiddenGroupsNote(blockType, styleGroups, hiddenControls)}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="nb-pb-inspector__note">Full styling isn&apos;t available for this block yet.</p>
      )}
    </>
  )

  const layoutTab = (
    <>
      {showVariant && variantPath ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see VariantPickerField's SelectFieldClientComponent prop contract note above
        <VariantPickerField {...({ path: variantPath, field: { label: 'Variant' } } as any)} />
      ) : null}

      {/* Height, alignment, media side, overlay — layout decisions, derived
          by name from LAYOUT_FIELD_NAMES. */}
      <BlockLayoutFields />

      {isStylable && layoutGroups.length > 0 ? (
        <div className="nb-pb-inspector__groups">
          <AllStyleGroups
            style={thisStyle}
            groups={layoutGroups}
            scope="instance"
            onChange={handleChange}
            resetKey={selectedId}
            onPreview={onPreview}
            onPreviewEnd={onPreviewEnd}
          />
        </div>
      ) : null}
    </>
  )

  return (
    <div className="nb-pb-inspector">
      <h3 className="nb-pb-inspector__header">{labelFor(blockType)}</h3>

      <div className="nb-pb-inspector__tabs" role="tablist" aria-label="Block settings">
        {(['content', 'style', 'layout'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`nb-pb-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`nb-pb-tabpanel-${id}`}
            className={`nb-pb-inspector__tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {id === 'content' ? 'Content' : id === 'style' ? 'Style' : 'Layout'}
          </button>
        ))}
      </div>

      {tab === 'content' ? (
        <div role="tabpanel" id="nb-pb-tabpanel-content" aria-labelledby="nb-pb-tab-content">
          <BlockContentEditor />
        </div>
      ) : tab === 'style' ? (
        <div role="tabpanel" id="nb-pb-tabpanel-style" aria-labelledby="nb-pb-tab-style">
          {styleTab}
        </div>
      ) : (
        <div role="tabpanel" id="nb-pb-tabpanel-layout" aria-labelledby="nb-pb-tab-layout">
          {layoutTab}
        </div>
      )}
    </div>
  )
}
