'use client'
import * as React from 'react'
import { BLOCK_STYLE_VOCAB, type BlockStyle, type VocabControl, type MultiVocabControl } from '@/lib/block-style/vocabulary'
import { getControlValue, STYLABLE_BLOCK_TYPES, type StyleGroupKey } from '@/lib/block-style/panel'
import { resolveControlOrigin, countGroupOverrides, type ControlOrigin } from '@/lib/block-style/origin'
import { promoteBlockStyle } from '@/components/admin/promoteBlockStyle'
import '@/components/admin/page-builder/page-builder.css'

/**
 * Shared vocabulary-driven control rendering for the block-style admin UI —
 * factored out of Task 6's `BlockStyleField` so Task 7's store-wide
 * `BlockStyleDefaultsField` (same controls, different key: blockType instead
 * of block id) renders from the identical component instead of a duplicate
 * copy. Both panels build a `BlockStyle` object; only how they read/write it
 * into the parent form differs, which stays in each field's own component.
 *
 * Task 4 reshape: `AllStyleGroups` now only renders the groups its caller
 * names (`styleGroupsFor(blockType)`, Task 2) instead of all six for every
 * block, and a control's widget is derived from its own vocabulary shape
 * rather than a uniform "Default"-able `<select>` — see `controlForm` below.
 * `scope` distinguishes the two callers that show an origin/reset layer
 * (`instance`, where the cascade is theme -> store -> this block) from the
 * one that doesn't (`store`, the store-wide defaults panel itself, where
 * `style` already *is* the store layer and there is no instance above it).
 */

type AnyControlGroup = Record<string, VocabControl<string> | MultiVocabControl<string>>

export type StyleChangeHandler = (group: keyof BlockStyle, control: string, value: string | undefined) => void

/** Fired when the pointer settles on a segmented/stepped option — see `useHoverPreview`. Optional: `BlockStyleField`/`BlockStyleDefaultsField` have no live canvas to preview against. */
export type StylePreviewHandler = (group: StyleGroupKey, control: string, value: string | undefined) => void

/** `instance`: per-block override panel, cascade is theme -> store -> this block. `store`: the store-wide defaults panel, cascade is theme -> this — there's no instance layer to show an origin or a reset against. */
export type StyleScope = 'instance' | 'store'

/** Presentation order for the six vocabulary groups — lives here once so no caller can scramble it. */
const GROUP_ORDER: StyleGroupKey[] = ['section', 'heading', 'eyebrow', 'subheading', 'accent', 'media']

const GROUP_TITLES: Record<StyleGroupKey, string> = {
  section: 'Section',
  heading: 'Heading',
  eyebrow: 'Eyebrow',
  subheading: 'Subheading',
  accent: 'Accent span',
  media: 'Media',
}

function controlLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * Chooses a control's widget from its own vocabulary shape — never a
 * hand-kept lookup table, so a vocabulary change can't desynchronise it:
 *
 * - exactly two options whose values are the on/off pair -> a switch
 *   (the decision is binary, so it should look binary)
 * - three or fewer options -> a segmented control (a handful of named choices)
 * - more than three -> a stepped segmented scale (an ordered range, e.g. size)
 */
export function controlForm(group: StyleGroupKey, control: string): 'switch' | 'segmented' | 'scale' {
  const def = (BLOCK_STYLE_VOCAB[group] as unknown as AnyControlGroup)[control]
  const options = def.options
  if (options.length === 2 && options.every((o) => o.value === 'on' || o.value === 'off')) return 'switch'
  if (options.length <= 3) return 'segmented'
  return 'scale'
}

/**
 * `hasStoreLayer` is whether the caller passed a `storeStyle` prop to
 * `AllStyleGroups` at all, not whether the store layer happens to have a
 * value for this control — `BlockInspector`/`BlockStyleField` never pass
 * `storeStyle` (a documented, deliberate gap: `blockStyleDefaults` lives on a
 * different Payload document and `useField` can't cross documents), so
 * "Theme" would be a confidently wrong label for a control the store HAS
 * set — the merchant can see its value rendering on the canvas right beside
 * the chip. "Inherited" is the honest label when there's no way to tell
 * theme-only apart from store-set.
 */
function originLabel(origin: ControlOrigin, hasStoreLayer: boolean): string {
  if (origin.kind === 'store') return `Store · ${origin.label}`
  return hasStoreLayer ? 'Theme' : 'Inherited'
}

/** One control: its label, its widget, an inherited-state chip, and (in instance scope, when overridden) a reset. */
function StyleControl({
  group,
  control,
  def,
  style,
  storeStyle,
  scope,
  onChange,
  onPreview,
  onPreviewEnd,
}: {
  group: StyleGroupKey
  control: string
  def: VocabControl<string> | MultiVocabControl<string>
  style: BlockStyle
  storeStyle?: BlockStyle
  scope: StyleScope
  onChange: StyleChangeHandler
  onPreview?: StylePreviewHandler
  onPreviewEnd?: () => void
}) {
  const value = getControlValue(style, group, control)
  const kind = controlForm(group, control)
  const label = controlLabel(control)

  // `store` scope has no instance layer above it — `storeStyle` would be
  // meaningless there, since `style` itself *is* the store layer. No origin
  // chip, no override dot in that scope's sense — but a switch there can
  // still hold an explicit, settable value (see `isOverridden` below).
  const origin = scope === 'instance' ? resolveControlOrigin(style, storeStyle ?? {}, group, control) : undefined
  // In store scope there's no `instance` layer to compare against — the
  // control's own set-ness IS the override state. Without this, a switch's
  // `isOverridden` was always `false` in store scope (origin was always
  // `undefined`), so its reset button never rendered — and a switch can only
  // ever write an explicit `on`/`off`, never `undefined`, making a store-wide
  // switch a one-way door once touched.
  const isOverridden = scope === 'store' ? !!value : origin?.kind === 'instance'
  const showOriginChip = kind !== 'switch' && !!origin && origin.kind !== 'instance'
  const hasStoreLayer = storeStyle !== undefined

  const setValue = (next: string | undefined) => onChange(group, control, next)

  // A switch has no origin chip to show an inherited value through, so it must
  // show the RESOLVED value itself (own -> store -> theme's "nothing set"),
  // not just its own layer. `on`/`off` are both real, distinct stored values
  // (see BLOCK_STYLE_VOCAB's ON_OFF_OPTIONS — `off` maps to an explicit CSS
  // value, different from unset), so an instance must be able to write an
  // explicit `off` to override an inherited `on`. Clearing back to "inherit"
  // stays the Reset button's job (above) — a switch click only ever writes
  // one of the two real values, never `undefined`.
  const switchValue = origin ? (origin.kind === 'theme' ? undefined : origin.value) : value

  return (
    <div className="nb-style-control">
      <div className="nb-style-control__head">
        <span className="nb-style-control__label">{label}</span>
        {isOverridden ? (
          <span className="nb-style-control__override">
            <span className="nb-style-control__dot" aria-hidden="true" />
            <button type="button" className="nb-style-control__reset" onClick={() => setValue(undefined)}>
              {`Reset ${control}`}
            </button>
          </span>
        ) : null}
      </div>
      {showOriginChip ? (
        <span className="nb-style-control__origin">{originLabel(origin as ControlOrigin, hasStoreLayer)}</span>
      ) : null}
      {kind === 'switch' ? (
        <SwitchControl
          label={label}
          checked={switchValue === 'on'}
          onChange={(checked) => setValue(checked ? 'on' : 'off')}
        />
      ) : (
        <SegmentedControl
          label={label}
          options={def.options}
          value={value}
          scale={kind === 'scale'}
          onChange={setValue}
          onPreview={onPreview ? (optionValue) => onPreview(group, control, optionValue) : undefined}
          onPreviewEnd={onPreviewEnd}
        />
      )}
    </div>
  )
}

/** A binary decision, rendered as what it is instead of a two-item dropdown. */
function SwitchControl({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`nb-style-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="nb-style-switch__thumb" aria-hidden="true" />
    </button>
  )
}

/** A handful of named choices (`scale=false`) or an ordered range (`scale=true`) — same interaction, different visual weight. Clicking the active option clears it back to "inherit". */
function SegmentedControl({
  label,
  options,
  value,
  scale,
  onChange,
  onPreview,
  onPreviewEnd,
}: {
  label: string
  options: { label: string; value: string }[]
  value: string | undefined
  scale: boolean
  onChange: (value: string | undefined) => void
  onPreview?: (value: string) => void
  onPreviewEnd?: () => void
}) {
  return (
    <div
      className={`nb-style-segmented${scale ? ' nb-style-segmented--scale' : ''}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`nb-style-segmented__option${active ? ' is-active' : ''}`}
            onClick={() => onChange(active ? undefined : option.value)}
            onMouseEnter={onPreview ? () => onPreview(option.value) : undefined}
            onMouseLeave={onPreviewEnd}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** The grid of controls for one vocabulary group — the part shared by a plain group and a collapsible one. */
function ControlGrid({
  group,
  style,
  storeStyle,
  scope,
  onChange,
  onPreview,
  onPreviewEnd,
}: {
  group: keyof BlockStyle
  style: BlockStyle
  storeStyle?: BlockStyle
  scope: StyleScope
  onChange: StyleChangeHandler
  onPreview?: StylePreviewHandler
  onPreviewEnd?: () => void
}) {
  const controls = BLOCK_STYLE_VOCAB[group] as unknown as AnyControlGroup
  return (
    <div className="nb-style-group__grid">
      {Object.entries(controls).map(([control, def]) => (
        <StyleControl
          key={control}
          group={group}
          control={control}
          def={def}
          style={style}
          storeStyle={storeStyle}
          scope={scope}
          onChange={onChange}
          onPreview={onPreview}
          onPreviewEnd={onPreviewEnd}
        />
      ))}
    </div>
  )
}

/**
 * Joins the resolved value of every control in a typography group into one
 * line, in vocabulary order, for a collapsed group's summary — skipping any
 * control that resolves to the theme (nothing set anywhere in the cascade),
 * since "Default" for every field would just be noise. `'Default'` itself is
 * the fallback when nothing in the group is set at all.
 *
 * A store-inherited value is prefixed with `originLabel()`'s existing
 * `"Store · "` convention — the same one every open control in the panel
 * already uses — so the collapsed summary doesn't erase the distinction the
 * expanded view is careful to draw between "this instance set it" and
 * "it's inherited". An instance override stays bare, matching the expanded
 * view's own StyleControl, which shows no chip at all for its own value.
 */
function summariseTypographyGroup(
  group: 'eyebrow' | 'heading' | 'subheading',
  style: BlockStyle,
  storeStyle: BlockStyle | undefined,
): string {
  const controls = Object.keys(BLOCK_STYLE_VOCAB[group] as unknown as AnyControlGroup)
  const labels: string[] = []
  const hasStoreLayer = storeStyle !== undefined
  const resolvedStore = storeStyle ?? {}
  for (const control of controls) {
    const origin = resolveControlOrigin(style, resolvedStore, group, control)
    if (origin.kind === 'theme') continue
    labels.push(origin.kind === 'instance' ? origin.label : originLabel(origin, hasStoreLayer))
  }
  return labels.length > 0 ? labels.join(', ') : 'Default'
}

/**
 * Eyebrow/heading/subheading share the same typography control set — one
 * renderer for all three, and the only groups rendered as a collapsible
 * disclosure rather than always-open. They are 18 of the vocabulary's 28
 * controls (Task 5): three groups repeating the identical six controls, which
 * made the panel's biggest source of scroll depth. Collapsed, a group shows
 * its resolved values as one summary line instead of six repeated widgets.
 *
 * `resetKey` mirrors `BlockInspector`'s own `tabOwner` pattern: compared
 * during render (not in an effect, so there's no one-frame flash of the
 * previous block's open/closed state), and reset back to the group's default
 * open state whenever it changes. Callers that never switch which block this
 * component instance represents (`BlockStyleField`, `BlockStyleDefaultsField`
 * — each mounts one instance per block/row for its whole lifetime) simply
 * never pass it, so the comparison never fires and open/closed state behaves
 * like ordinary component state.
 */
export function TypographyGroup({
  title,
  group,
  style,
  storeStyle,
  scope,
  onChange,
  resetKey,
  onPreview,
  onPreviewEnd,
}: {
  title: string
  group: 'eyebrow' | 'heading' | 'subheading'
  style: BlockStyle
  storeStyle?: BlockStyle
  scope: StyleScope
  onChange: StyleChangeHandler
  resetKey?: string
  onPreview?: StylePreviewHandler
  onPreviewEnd?: () => void
}) {
  const defaultOpen = group === 'heading'
  const [open, setOpen] = React.useState(defaultOpen)
  const [owner, setOwner] = React.useState(resetKey)
  if (owner !== resetKey) {
    setOwner(resetKey)
    setOpen(defaultOpen)
  }

  const overrideCount = countGroupOverrides(style, group)
  const summary = summariseTypographyGroup(group, style, storeStyle)

  return (
    <fieldset className="nb-style-group" onMouseLeave={onPreviewEnd}>
      <legend className="nb-style-group__title">
        <button
          type="button"
          className="nb-style-group__disclosure"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{title}</span>
          {overrideCount > 0 ? (
            <span className="nb-style-group__count" data-testid={`nb-group-count-${group}`}>
              {overrideCount}
            </span>
          ) : null}
        </button>
      </legend>
      {open ? (
        <ControlGrid
          group={group}
          style={style}
          storeStyle={storeStyle}
          scope={scope}
          onChange={onChange}
          onPreview={onPreview}
          onPreviewEnd={onPreviewEnd}
        />
      ) : (
        <p className="nb-style-group__summary" data-testid={`nb-group-summary-${group}`}>
          {summary}
        </p>
      )}
    </fieldset>
  )
}

/** Renders one vocabulary group (`BLOCK_STYLE_VOCAB[group]`) as a labelled grid of controls — always open, no disclosure. Used for the three non-typography groups (section, accent, media), which don't repeat and aren't worth collapsing. */
export function ControlGroupPanel({
  title,
  group,
  style,
  storeStyle,
  scope,
  onChange,
  onPreview,
  onPreviewEnd,
}: {
  title: string
  group: keyof BlockStyle
  style: BlockStyle
  storeStyle?: BlockStyle
  scope: StyleScope
  onChange: StyleChangeHandler
  onPreview?: StylePreviewHandler
  onPreviewEnd?: () => void
}) {
  return (
    <fieldset className="nb-style-group" onMouseLeave={onPreviewEnd}>
      <legend className="nb-style-group__title">{title}</legend>
      <ControlGrid
        group={group}
        style={style}
        storeStyle={storeStyle}
        scope={scope}
        onChange={onChange}
        onPreview={onPreview}
        onPreviewEnd={onPreviewEnd}
      />
    </fieldset>
  )
}

/** Human label for a block type, sourced from the registry so copy can never drift from it (`STYLABLE_BLOCK_TYPES` in `src/lib/block-style/panel.ts`). Falls back to the raw slug only for a blockType the registry doesn't know about, which should not happen in practice since the affordance only renders for stylable blocks. */
function blockTypeLabel(blockType: string): string {
  return STYLABLE_BLOCK_TYPES.find((b) => b.value === blockType)?.label ?? blockType
}

/**
 * The button + confirmation that writes this block's current style as the
 * store-wide default for its block type (`promoteBlockStyle`) — the only
 * place the page builder writes outside the document it is editing, which is
 * why it never fires without an explicit, specific confirmation naming what
 * it affects.
 *
 * The block's OWN overrides are deliberately left alone on success. An earlier
 * reading cleared them as redundant, which made a successful promote look
 * exactly like a failure: the canvas iframe is still server-rendered from the
 * PREVIOUS store defaults, so stripping those keys from the live `--bs-*`
 * patch reverted the block on screen — and `BlockInspector` passes no
 * `storeStyle`, so every cleared control then read "Theme" instead of the
 * store value that had just been written. The write to store settings is the
 * whole effect; the confirmation line below is what says it happened.
 *
 * Copy never pluralises `label`: it comes from `STYLABLE_BLOCK_TYPES`, where
 * seven of the twenty labels already end in "s" ("Categories", "Reviews",
 * "Steps", "Hero"…), so appending one produced "Use for all Categoriess".
 */
function PromoteToStoreWide({
  blockType,
  style,
  promote,
}: {
  blockType: string
  style: BlockStyle
  promote: (blockType: string, style: BlockStyle) => Promise<void>
}) {
  const [confirming, setConfirming] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const label = blockTypeLabel(blockType)
  const affordance = `Use this style for all ${label} blocks`

  const handleApply = () => {
    setError(null)
    setSaved(false)
    setPending(true)
    promote(blockType, style)
      .then(() => setSaved(true))
      .catch(() => {
        // Nothing here writes to the instance on either path, so a failure
        // leaves the block exactly as it was — the message says so rather than
        // leaving the merchant to infer it.
        setError(`Could not save the store-wide default for ${label}. This block's own style was not changed.`)
      })
      // The dialog stays up for the whole round trip and closes only once it
      // settles, so there is never a frame with neither a dialog nor a result.
      .finally(() => {
        setPending(false)
        setConfirming(false)
      })
  }

  const openDialog = () => {
    setSaved(false)
    setError(null)
    setConfirming(true)
  }

  return (
    <div className="nb-style-promote">
      <button type="button" className="nb-style-promote__trigger" onClick={openDialog}>
        {affordance}
      </button>
      {confirming ? (
        <div role="dialog" aria-label={affordance} className="nb-style-promote__dialog">
          <p>
            {`This replaces the store-wide default for every ${label} block on your storefront, including on other pages. Your other pages will change.`}
          </p>
          <div className="nb-style-promote__actions">
            <button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={handleApply}>
              Apply to all
            </button>
          </div>
        </div>
      ) : null}
      {saved ? (
        <p role="status" className="nb-style-promote__saved">
          {`Saved as the default for all ${label} blocks.`}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="nb-style-promote__error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The vocabulary groups a caller names, in the fixed presentation order —
 * `groups` says which of the six are relevant (`styleGroupsFor(blockType)`),
 * so a block with no eyebrow no longer offers seven inert eyebrow controls.
 */
export function AllStyleGroups({
  style,
  groups,
  scope,
  storeStyle,
  blockType,
  onChange,
  resetKey,
  onPreview,
  onPreviewEnd,
  promote,
}: {
  style: BlockStyle
  groups: StyleGroupKey[]
  scope: StyleScope
  storeStyle?: BlockStyle
  /** This block's type, e.g. `"hero"` — enables the "Use this style for all Hero blocks" promote-to-store-wide affordance. Only meaningful (and only rendered) in `scope: 'instance'`: in `scope: 'store'` this panel already IS the store-wide default, so promoting is meaningless. */
  blockType?: string
  onChange: StyleChangeHandler
  /** Forwarded to `TypographyGroup` — see its doc comment. Only `BlockInspector` passes this today. */
  resetKey?: string
  /** Live-preview hooks (Task 7) — optional. `BlockStyleField`/`BlockStyleDefaultsField` have no live canvas and pass neither. */
  onPreview?: StylePreviewHandler
  onPreviewEnd?: () => void
  /** Overridable for tests; defaults to the real `promoteBlockStyle`, which writes to StoreSettings via the tenant-scoped REST route. */
  promote?: (blockType: string, style: BlockStyle) => Promise<void>
}) {
  const ordered = GROUP_ORDER.filter((group) => groups.includes(group))
  return (
    <>
      {ordered.map((group) =>
        group === 'eyebrow' || group === 'heading' || group === 'subheading' ? (
          <TypographyGroup
            key={group}
            title={GROUP_TITLES[group]}
            group={group}
            style={style}
            storeStyle={storeStyle}
            scope={scope}
            onChange={onChange}
            resetKey={resetKey}
            onPreview={onPreview}
            onPreviewEnd={onPreviewEnd}
          />
        ) : (
          <ControlGroupPanel
            key={group}
            title={GROUP_TITLES[group]}
            group={group}
            style={style}
            storeStyle={storeStyle}
            scope={scope}
            onChange={onChange}
            onPreview={onPreview}
            onPreviewEnd={onPreviewEnd}
          />
        ),
      )}
      {scope === 'instance' && blockType ? (
        <PromoteToStoreWide blockType={blockType} style={style} promote={promote ?? promoteBlockStyle} />
      ) : null}
    </>
  )
}
